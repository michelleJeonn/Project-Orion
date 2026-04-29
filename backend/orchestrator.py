"""
Cryosis Orchestrator
Drives the 4-stage drug discovery pipeline via Langflow custom components.
Each stage is a Langflow Component; the orchestrator sequences them,
threads progress updates to the DB, and persists the final report.
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import AsyncIterator

from backend.langflow_compat import Data

from backend.langflow_components import (
    DiseaseIntelligenceComponent,
    DockingComponent,
    InsightSynthesisComponent,
    MolecularGenerationComponent,
)
from backend.models.disease import Disease
from backend.models.molecule import MoleculeLibrary
from backend.models.report import CryosisReport, DockingResult, PipelineStage
from backend.db.session import AsyncSessionLocal
from backend.db import crud
from backend.utils.logger import get_logger
from backend.config import settings

logger = get_logger(__name__)


class CryosisOrchestrator:

    async def create_job(self, disease_query: str) -> str:
        job_id = str(uuid.uuid4())
        async with AsyncSessionLocal() as db:
            await crud.create_job(db, job_id, disease_query)
        return job_id

    async def run_pipeline(self, job_id: str, disease_query: str) -> CryosisReport:
        """
        Execute the full 4-stage pipeline via Langflow components.
        Each component wraps its agent; progress is written to the DB
        between stages so the SSE stream stays live.
        """
        start_time = datetime.utcnow()

        async with AsyncSessionLocal() as db:

            async def progress(message: str, pct: int, stage: PipelineStage = None):
                await crud.update_progress(
                    db,
                    job_id,
                    message=message,
                    progress=float(pct),
                    stage=stage.value if stage else None,
                )
                logger.info(f"[{job_id[:8]}] {pct}% — {message}")

            try:
                # ── Stage 1: Disease Intelligence ──────────────────────────── #
                await crud.update_progress(
                    db, job_id,
                    message="Analyzing disease...",
                    progress=5.0,
                    stage=PipelineStage.DISEASE_ANALYSIS.value,
                    started_at=start_time,
                )

                disease_comp = DiseaseIntelligenceComponent()
                disease_comp.disease_query = disease_query
                disease_comp.max_targets = 3
                disease_data: Data = await disease_comp.build_disease_data()
                disease = Disease.model_validate(disease_data.data)

                await progress(
                    f"Identified {len(disease.targets)} targets: "
                    + ", ".join(t.gene_symbol for t in disease.targets),
                    48,
                    PipelineStage.TARGET_DISCOVERY,
                )

                if not disease.targets:
                    raise ValueError(
                        f"No druggable targets found for '{disease_query}'. "
                        "Try a more specific disease name."
                    )

                # ── Stage 2: Molecular Generation ─────────────────────────── #
                await progress("Generating molecular candidates...", 50, PipelineStage.MOLECULAR_GENERATION)

                n_molecules = settings.demo_max_molecules if settings.demo_mode else 50
                libraries: list[MoleculeLibrary] = []

                for i, target in enumerate(disease.targets):
                    await progress(
                        f"Generating molecules for {target.gene_symbol} ({i + 1}/{len(disease.targets)})...",
                        50 + i * 3,
                    )
                    molgen_comp = MolecularGenerationComponent()
                    molgen_comp.target_data = Data(data=target.model_dump(mode="json"))
                    molgen_comp.n_molecules = n_molecules
                    lib_data: Data = await molgen_comp.build_molecule_library()
                    library = MoleculeLibrary.model_validate(lib_data.data)
                    libraries.append(library)
                    logger.info(f"Library for {target.gene_symbol}: {len(library.molecules)} molecules")

                # ── Stage 3: Docking ──────────────────────────────────────── #
                await progress("Running docking simulations...", 70, PipelineStage.DOCKING)

                docking_results: dict[str, list[DockingResult]] = {}

                for i, (target, library) in enumerate(zip(disease.targets, libraries)):
                    await progress(
                        f"Docking against {target.gene_symbol} ({i + 1}/{len(disease.targets)})...",
                        70 + i * 4,
                    )
                    docking_comp = DockingComponent()
                    docking_comp.target_data = Data(data=target.model_dump(mode="json"))
                    docking_comp.molecule_library = Data(data=library.model_dump(mode="json"))
                    results_data: Data = await docking_comp.build_docking_results()
                    results = [DockingResult.model_validate(r) for r in results_data.data["results"]]
                    docking_results[target.uniprot_id] = results
                    if results:
                        logger.info(
                            f"{target.gene_symbol}: best ΔG = {results[0].binding_affinity_kcal:.1f} kcal/mol"
                        )

                # ── Stage 4: Insight Synthesis ───────────────────────────── #
                await progress("Synthesizing insights and generating report...", 87, PipelineStage.INSIGHT_SYNTHESIS)

                synthesis_comp = InsightSynthesisComponent()
                synthesis_comp.job_id = job_id
                synthesis_comp.disease_data = Data(data=disease.model_dump(mode="json"))
                synthesis_comp.libraries_data = Data(data={
                    "libraries": [lib.model_dump(mode="json") for lib in libraries]
                })
                synthesis_comp.docking_data = Data(data={
                    "results_per_target": {
                        uid: [r.model_dump(mode="json") for r in results]
                        for uid, results in docking_results.items()
                    }
                })
                synthesis_comp.pipeline_start_time = start_time.isoformat()
                report_data: Data = await synthesis_comp.build_report()
                report = CryosisReport.model_validate(report_data.data)

                # ── Persist completed report ─────────────────────────────── #
                await crud.complete_job(db, job_id, report.model_dump(mode="json"))

                duration = (datetime.utcnow() - start_time).total_seconds()
                logger.info(
                    f"Pipeline complete for job {job_id} in {duration:.1f}s | "
                    f"targets={len(disease.targets)}, "
                    f"candidates={sum(len(lib.molecules) for lib in libraries)}"
                )
                return report

            except Exception as e:
                logger.error(f"Pipeline failed for job {job_id}: {e}", exc_info=True)
                await crud.fail_job(db, job_id, str(e))
                raise

    async def stream_progress(self, job_id: str) -> AsyncIterator[str]:
        """
        Async generator for Server-Sent Events (SSE).
        Polls the DB until the job completes or fails.
        """
        poll_interval = 0.5
        max_polls = 1800  # 15 minutes

        async with AsyncSessionLocal() as db:
            for _ in range(max_polls):
                job = await crud.get_job(db, job_id)
                if job is None:
                    yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                    return

                payload: dict = {
                    "job_id": job_id,
                    "stage": job.stage,
                    "progress": job.progress,
                    "message": job.message,
                }
                if job.error:
                    payload["error"] = job.error

                yield f"data: {json.dumps(payload)}\n\n"

                if job.stage in ("completed", "failed"):
                    return

                # Expire the cached instance so the next poll re-fetches from DB
                # instead of returning SQLAlchemy's stale identity-map copy.
                db.expire(job)
                await asyncio.sleep(poll_interval)

        yield f"data: {json.dumps({'error': 'Timeout waiting for pipeline'})}\n\n"


# Singleton orchestrator instance
orchestrator = CryosisOrchestrator()
