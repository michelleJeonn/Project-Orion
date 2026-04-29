"""
Cryosis API — FastAPI application entry point.

Endpoints:
  POST   /api/discover          Start a pipeline job
  GET    /api/jobs/{job_id}     Get job status
  GET    /api/results/{job_id}  Get final report (when complete)
  GET    /api/stream/{job_id}   SSE progress stream
  GET    /api/jobs              List all jobs
  GET    /health                Health check
"""
import json
import re
from contextlib import asynccontextmanager

import anthropic as ant

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.orchestrator import orchestrator
from backend.models.report import CryosisReport
from backend.config import settings
from backend.utils.logger import get_logger
from backend.services.arxiv import arxiv_client
from backend.services.alphafold import alphafold_client
from backend.services.snowflake_client import init_snowflake_tables
from backend.analytics.snowflake_analytics import snowflake_analytics
from backend.db.session import get_db, init_db, engine
from backend.db import crud

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}. Running in offline mode.")
    try:
        init_snowflake_tables()
    except Exception as e:
        logger.warning(f"Snowflake init skipped: {e}")
    logger.info("Cryosis API starting up")
    yield
    try:
        await engine.dispose()
    except Exception as e:
        logger.warning(f"Database disposal failed: {e}")
    logger.info("Cryosis API shutting down")


app = FastAPI(
    title="Cryosis Drug Discovery API",
    description="Autonomous AI-powered drug discovery from disease query to molecular candidates",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ─────────────────────────────────────────── #

class DiscoverRequest(BaseModel):
    disease: str = Field(
        ...,
        min_length=2,
        max_length=200,
        examples=["Parkinson's disease", "triple-negative breast cancer"],
        description="Natural language disease name",
    )
    max_targets: int = Field(default=3, ge=1, le=5)
    max_molecules: int = Field(default=50, ge=10, le=200)


class DiscoverResponse(BaseModel):
    job_id: str
    message: str
    stream_url: str
    status_url: str
    results_url: str


# ── Background task ────────────────────────────────────────────────────── #

async def _run_pipeline_task(job_id: str, disease_query: str):
    """Background task wrapper — creates its own DB session, swallows exceptions."""
    try:
        await orchestrator.run_pipeline(job_id, disease_query)
    except Exception as e:
        logger.error(f"Background pipeline error for {job_id}: {e}")


# ── Routes ─────────────────────────────────────────────────────────────── #

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "cryosis-api", "version": "1.0.0"}


@app.post("/api/discover", response_model=DiscoverResponse, status_code=202)
async def discover(
    request: DiscoverRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a disease query to start the drug discovery pipeline.
    Returns immediately with a job_id for polling/streaming.
    """
    job_id = str(__import__("uuid").uuid4())
    await crud.create_job(db, job_id, request.disease)
    logger.info(f"New job {job_id} for disease: '{request.disease}'")

    background_tasks.add_task(_run_pipeline_task, job_id, request.disease)

    return DiscoverResponse(
        job_id=job_id,
        message=f"Pipeline started for '{request.disease}'",
        stream_url=f"/api/stream/{job_id}",
        status_url=f"/api/jobs/{job_id}",
        results_url=f"/api/results/{job_id}",
    )


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get current status of a pipeline job."""
    job = await crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return {
        "job_id": job_id,
        "disease_query": job.disease_query,
        "stage": job.stage,
        "progress": job.progress,
        "message": job.message,
        "started_at": job.started_at,
        "updated_at": job.updated_at,
        "error": job.error,
        "has_results": job.result is not None,
    }


@app.get("/api/results/{job_id}")
async def get_results(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieve the final report for a completed pipeline job.
    Returns 202 Accepted if still processing.
    """
    job = await crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.stage == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline failed: {job.error}",
        )
    if job.stage != "completed" or job.result is None:
        return JSONResponse(
            status_code=202,
            content={
                "message": "Pipeline still running",
                "stage": job.stage,
                "progress": job.progress,
            },
        )
    return job.result


@app.get("/api/stream/{job_id}")
async def stream_progress(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Server-Sent Events (SSE) stream for real-time pipeline progress.
    Connect with EventSource in the browser.
    """
    job = await crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return StreamingResponse(
        orchestrator.stream_progress(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    """List all pipeline jobs (newest first)."""
    jobs = await crud.list_jobs(db)
    return [
        {
            "job_id": j.id,
            "disease_query": j.disease_query,
            "stage": j.stage,
            "progress": j.progress,
            "created_at": j.created_at,
        }
        for j in jobs
    ]


@app.get("/api/arxiv/search")
async def arxiv_search(q: str, max: int = 5):
    """
    Search arXiv for preprints relevant to a drug/disease query.
    Returns up to `max` results (capped at 20).
    """
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    max = min(max, 20)
    results = await arxiv_client.search(q.strip(), max_results=max)
    return results


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


def _fmt(val, fmt=".1f", fallback="N/A") -> str:
    if val is None:
        return fallback
    return format(val, fmt)


def _build_chat_context(report: CryosisReport) -> str:
    target_blocks = []
    for ins in report.target_insights:
        best = ins.top_molecules[0] if ins.top_molecules else None
        best_line = (
            f"\n  Best molecule: SMILES={best.molecule.smiles} | "
            f"ΔG={_fmt(best.binding_affinity_kcal)} kcal/mol | "
            f"method={best.docking_method}"
            if best else ""
        )
        target_blocks.append(
            f"TARGET: {ins.target_gene}\n"
            f"  Mechanism of action: {ins.mechanism_of_action}\n"
            f"  Pathway relevance:   {ins.pathway_relevance}\n"
            f"  Clinical context:    {ins.clinical_context}"
            f"{best_line}"
        )

    candidate_blocks = []
    for c in report.top_candidates[:7]:
        admet = c.molecule.admet
        interactions = "; ".join(
            f"{i.residue} {i.interaction_type}"
            + (f" {_fmt(i.distance_angstrom)} Å" if i.distance_angstrom else "")
            for i in c.interactions[:4]
        ) or "not analyzed"
        candidate_blocks.append(
            f"Rank {c.rank} | Target: {c.target_uniprot_id} | ΔG={_fmt(c.binding_affinity_kcal)} kcal/mol | method={c.docking_method}\n"
            f"  SMILES: {c.molecule.smiles}\n"
            f"  ADMET: MW={_fmt(admet.mw, '.0f')} Da | LogP={_fmt(admet.log_p)} | "
            f"QED={_fmt(admet.qed_score, '.2f')} | Lipinski={'pass' if admet.lipinski_pass else 'FAIL'} | "
            f"PAINS={'yes' if admet.has_pains else 'no'} | SA={_fmt(admet.synthetic_accessibility, '.1f')}\n"
            f"  Interactions: {interactions}\n"
            f"  Explanation: {c.explanation[:400]}"
        )

    safety_text = "\n".join(f"- {f}" for f in report.safety_flags) or "None reported"
    limitations_text = "\n".join(f"- {l}" for l in report.limitations) or "None reported"

    return f"""You are a scientific research assistant for a computational drug discovery campaign.
Answer questions concisely and scientifically, citing specific data from the report.
If a question cannot be answered from the report data below, say so clearly.

══ DISEASE ══════════════════════════════════════════════════════
Name:        {report.disease_name}
Description: {report.disease_description}

══ PIPELINE STATISTICS ══════════════════════════════════════════
Targets analyzed:      {report.targets_analyzed}
Molecules generated:   {report.molecules_generated}
Molecules docked:      {report.molecules_docked}
Top candidates ranked: {len(report.top_candidates)}

══ TARGET INSIGHTS ══════════════════════════════════════════════
{chr(10).join(target_blocks)}

══ TOP DRUG CANDIDATES ══════════════════════════════════════════
{chr(10).join(candidate_blocks)}

══ SAFETY FLAGS ═════════════════════════════════════════════════
{safety_text}

══ LIMITATIONS ══════════════════════════════════════════════════
{limitations_text}

══ EXECUTIVE SUMMARY ════════════════════════════════════════════
{report.executive_summary}

══ METHODOLOGY ══════════════════════════════════════════════════
{report.methodology_notes}"""


@app.post("/api/chat/{job_id}")
async def chat_with_report(
    job_id: str,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Stream a Claude response grounded in the completed pipeline report.
    Returns SSE with chunks: data: {"text": "..."} and data: [DONE]
    """
    job = await crud.get_job(db, job_id)
    if not job or not job.result:
        raise HTTPException(status_code=404, detail="Report not found or pipeline not complete")

    report = CryosisReport.model_validate(job.result)
    system = _build_chat_context(report)

    client = ant.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def stream_response():
        try:
            async with client.messages.stream(
                model=settings.anthropic_model,
                max_tokens=1024,
                system=system,
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'text': 'Error generating response. Please try again.'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/structure/{filename}")
async def get_structure_file(filename: str):
    """
    Serve a structure file (PDB, SDF) from the structures directory for 3D visualization.
    Only alphanumeric filenames with hyphens, underscores, and dots are allowed.
    """
    if not re.match(r'^[\w\-\.]+$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    file_path = settings.structures_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Structure file not found")
    return FileResponse(str(file_path), media_type="text/plain")


@app.get("/api/alphafold/{uniprot_id}")
async def get_alphafold_structure(uniprot_id: str):
    """
    Ensure an AlphaFold predicted structure is downloaded for a UniProt accession,
    then return the filename so the frontend can load it via /api/structure/{filename}.
    """
    if not re.match(r'^[A-Za-z0-9]+$', uniprot_id):
        raise HTTPException(status_code=400, detail="Invalid UniProt ID")
    local_path = await alphafold_client.get_structure(uniprot_id)
    if not local_path:
        raise HTTPException(status_code=404, detail=f"No AlphaFold structure for {uniprot_id}")
    filename = f"AF-{uniprot_id}.pdb"
    return JSONResponse({"filename": filename, "uniprot_id": uniprot_id})


# ── Snowflake Chemical Intelligence Routes ────────────────────────────────── #

@app.get("/api/snowflake/similar_molecules/{job_id}/{molecule_id}")
async def similar_molecules(job_id: str, molecule_id: str, top_k: int = 10):
    """
    Return top-K nearest molecules by vector similarity across all jobs.
    Falls back to empty list when Snowflake is not configured.
    """
    results = snowflake_analytics.similar_molecules(job_id, molecule_id, top_k=min(top_k, 50))
    return results


@app.get("/api/snowflake/chemical_space/{job_id}")
async def chemical_space(job_id: str):
    """
    PCA(3D) projection of all molecules in a job for the Chemical Space Explorer.
    Falls back to empty list when Snowflake is not configured.
    """
    points = snowflake_analytics.chemical_space_pca(job_id)
    return points


@app.get("/api/snowflake/analytics")
async def snowflake_cross_run_analytics():
    """
    Cross-run analytics: generation method leaderboard, top targets, disease rankings.
    Falls back to empty data when Snowflake is not configured.
    """
    return snowflake_analytics.cross_run_analytics()


@app.get("/api/snowflake/search_reports")
async def search_reports(query: str = "", limit: int = 10):
    """
    Keyword search over stored GenesisReports using ILIKE.
    Returns matching report excerpts with matched section and snippet.
    """
    if not query or len(query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short (min 2 chars)")
    results = snowflake_analytics.search_reports(query.strip(), limit=min(limit, 50))
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "development",
    )
