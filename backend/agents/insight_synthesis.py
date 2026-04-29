"""
Insight Synthesis Agent
Translates all pipeline outputs into a comprehensive, human-readable report
using Claude as the intelligence layer.
"""
import asyncio
from datetime import datetime
from typing import Optional

from backend.agents.base_agent import BaseAgent
from backend.models.disease import Disease, Target
from backend.models.molecule import MoleculeLibrary, ObjectiveWeights
from backend.models.report import (
    CryosisReport,
    DockingResult,
    TargetInsight,
    ArXivPaper,
    ParetoAnalysis,
)
from backend.molecular.multi_objective import (
    compute_pareto_objectives,
    assign_pareto_ranks,
    compute_weighted_score,
)
from backend.services.arxiv import arxiv_client
from backend.config import settings


SYSTEM_SYNTHESIS = """You are an expert drug discovery scientist writing a comprehensive
analysis report. You combine computational results, structural biology, and pharmacology
to provide actionable insights. Write for a PhD-level scientific audience.
Be precise, quantitative where possible, and clearly distinguish predictions from facts."""


class InsightSynthesisAgent(BaseAgent):
    async def synthesize(
        self,
        job_id: str,
        disease: Disease,
        libraries: list[MoleculeLibrary],
        docking_results_per_target: dict[str, list[DockingResult]],
        pipeline_start_time: datetime,
        progress_callback=None,
    ) -> CryosisReport:
        """
        Generate the final CryosisReport from all pipeline outputs.
        """
        self.logger.info("Starting insight synthesis...")

        if progress_callback:
            await progress_callback("Analyzing target-specific insights...", 87)

        # Fetch disease-level arXiv papers in parallel with per-target work
        arxiv_disease_task = asyncio.create_task(
            arxiv_client.search_for_disease(disease.normalized_name)
        )

        # Build per-target insights in parallel
        insight_tasks = [
            self._build_target_insight(
                target,
                docking_results_per_target.get(target.uniprot_id, []),
                disease,
            )
            for target in disease.targets
        ]
        target_insights = await asyncio.gather(*insight_tasks, return_exceptions=True)
        target_insights = [t for t in target_insights if isinstance(t, TargetInsight)]

        # Collect disease-level arXiv papers
        arxiv_papers_raw = await arxiv_disease_task
        arxiv_papers = [
            ArXivPaper(
                arxiv_id=p["arxiv_id"],
                title=p["title"],
                authors=p["authors"],
                summary=p["summary"],
                published=p["published"],
                url=p["url"],
                categories=p["categories"],
            )
            for p in arxiv_papers_raw
        ]
        self.logger.info(f"arXiv: {len(arxiv_papers)} papers for '{disease.normalized_name}'")

        # Aggregate all docking results
        all_docking: list[DockingResult] = []
        for results in docking_results_per_target.values():
            all_docking.extend(results)

        if progress_callback:
            await progress_callback("Running multi-objective Pareto optimization...", 94)

        # Multi-objective Pareto optimization
        pareto_analysis = await self._run_pareto_optimization(
            all_docking, disease
        )

        # Re-rank by Pareto front then weighted score
        all_docking.sort(key=lambda r: (
            r.molecule.pareto_objectives.pareto_rank if r.molecule.pareto_objectives else 99,
            -(r.molecule.pareto_objectives.weighted_score if r.molecule.pareto_objectives else 0),
        ))
        top_candidates = all_docking[:10]

        # Safety flags
        safety_flags = self._collect_safety_flags(libraries)

        # Total counts
        total_generated = sum(lib.total_generated for lib in libraries)
        total_passed = sum(len(lib.molecules) for lib in libraries)
        total_docked = total_passed  # all passed-filter molecules are submitted to docking

        if progress_callback:
            await progress_callback("Generating executive summary...", 92)

        # Executive summary via Claude (enriched with arXiv context)
        exec_summary = await self._generate_executive_summary(
            disease=disease,
            top_candidates=top_candidates,
            target_insights=target_insights,
            total_generated=total_generated,
            total_docked=total_docked,
            arxiv_papers=arxiv_papers,
        )

        # Limitations
        limitations = self._identify_limitations(disease, libraries, docking_results_per_target)

        duration = (datetime.utcnow() - pipeline_start_time).total_seconds()

        report = CryosisReport(
            job_id=job_id,
            disease_query=disease.query,
            disease_name=disease.normalized_name,
            disease_description=disease.description,
            mondo_id=disease.mondo_id,
            do_id=disease.do_id,
            affected_genes=disease.affected_genes,
            executive_summary=exec_summary,
            targets_analyzed=len(disease.targets),
            molecules_generated=total_generated,
            molecules_docked=total_docked,
            target_insights=target_insights,
            top_candidates=top_candidates,
            safety_flags=safety_flags,
            limitations=limitations,
            methodology_notes=self._methodology_notes(),
            pipeline_duration_seconds=round(duration, 1),
            arxiv_papers=arxiv_papers,
            pareto_analysis=pareto_analysis,
        )

        self.logger.info(f"Report generated for job {job_id}")
        return report

    # ------------------------------------------------------------------ #

    async def _run_pareto_optimization(
        self,
        docking_results: list[DockingResult],
        disease: Disease,
    ) -> ParetoAnalysis:
        """
        Score every docked molecule across 6 objectives, assign Pareto ranks,
        ask Claude to weight objectives for this disease, then attach
        ParetoObjectives to each molecule in-place.
        """
        if not docking_results:
            return ParetoAnalysis(
                weights=ObjectiveWeights(),
                pareto_front_count=0,
                disease_context="No docking results to optimize.",
            )

        # Detect neurological disease context for BBB weighting
        neuro_keywords = {"parkinson", "alzheimer", "epilepsy", "multiple sclerosis",
                          "huntington", "als", "brain", "neurological", "cns", "glioma"}
        disease_lower = disease.normalized_name.lower()
        is_neurological = any(k in disease_lower for k in neuro_keywords)

        # Ask Claude to assign disease-context weights
        weights = await self._get_claude_weights(disease, is_neurological)

        # Compute raw objectives for each molecule
        objectives_list: list[list[float]] = []
        for result in docking_results:
            obj = compute_pareto_objectives(result.molecule, result.binding_affinity_kcal)
            result.molecule.pareto_objectives = obj
            objectives_list.append([
                obj.binding_affinity,
                obj.selectivity,
                obj.bbb_penetration,
                obj.metabolic_stability,
                obj.oral_absorption,
                obj.synthetic_accessibility,
            ])

        # Assign Pareto front ranks
        ranks = assign_pareto_ranks(objectives_list)
        pareto_front_count = ranks.count(1)

        # Attach rank + weighted score back onto each molecule
        for result, rank in zip(docking_results, ranks):
            obj = result.molecule.pareto_objectives
            if obj:
                obj.pareto_rank = rank
                obj.weighted_score = compute_weighted_score(obj, weights)

        self.logger.info(
            f"Pareto optimization: {pareto_front_count}/{len(docking_results)} on front 1"
        )
        return ParetoAnalysis(
            weights=weights,
            pareto_front_count=pareto_front_count,
            disease_context=weights.rationale,
            is_neurological=is_neurological,
        )

    async def _get_claude_weights(
        self,
        disease: Disease,
        is_neurological: bool,
    ) -> ObjectiveWeights:
        """Ask Claude to assign objective weights appropriate for this disease."""
        prompt = f"""You are optimizing drug candidates for: {disease.normalized_name}
Disease description: {disease.description[:300]}
CNS/neurological disease: {is_neurological}

Assign weights (0.0–1.0) for these 6 drug optimization objectives. Weights must sum to 1.0.
Choose weights that reflect what matters most for this specific disease:

- binding_affinity: How tightly the drug binds the target protein
- selectivity: How specific it is (fewer off-target effects / side effects)
- bbb_penetration: Blood-brain barrier crossing (critical for CNS drugs)
- metabolic_stability: How long it survives in the body before being broken down
- oral_absorption: Can it be taken as a pill? (oral bioavailability)
- synthetic_accessibility: How easy is it to manufacture?

Return JSON only:
{{
  "binding_affinity": 0.XX,
  "selectivity": 0.XX,
  "bbb_penetration": 0.XX,
  "metabolic_stability": 0.XX,
  "oral_absorption": 0.XX,
  "synthetic_accessibility": 0.XX,
  "rationale": "One sentence explaining the weighting logic for this disease."
}}"""

        if settings.demo_mode:
            if is_neurological:
                return ObjectiveWeights(
                    binding_affinity=0.25, selectivity=0.20, bbb_penetration=0.25,
                    metabolic_stability=0.15, oral_absorption=0.10, synthetic_accessibility=0.05,
                    rationale=f"Demo mode: BBB penetration prioritized for {disease.normalized_name}.",
                )
            return ObjectiveWeights(rationale=f"Demo mode: default weights for {disease.normalized_name}.")

        try:
            result = await self.ask_claude_json(
                system=SYSTEM_SYNTHESIS,
                prompt=prompt,
                max_tokens=512,
            )
            # Normalize weights to sum to 1.0
            keys = ["binding_affinity", "selectivity", "bbb_penetration",
                    "metabolic_stability", "oral_absorption", "synthetic_accessibility"]
            raw = {k: float(result.get(k, 1/6)) for k in keys}
            total = sum(raw.values()) or 1.0
            normalized = {k: round(v / total, 3) for k, v in raw.items()}
            return ObjectiveWeights(
                **normalized,
                rationale=result.get("rationale", ""),
            )
        except Exception as e:
            self.logger.warning(f"Claude weight assignment failed: {e}")
            # Sensible defaults: up-weight BBB for neurological diseases
            if is_neurological:
                return ObjectiveWeights(
                    binding_affinity=0.25, selectivity=0.20, bbb_penetration=0.25,
                    metabolic_stability=0.15, oral_absorption=0.10, synthetic_accessibility=0.05,
                    rationale=f"Default neurological weights applied — BBB penetration prioritized for {disease.normalized_name}.",
                )
            return ObjectiveWeights(
                rationale=f"Default weights applied for {disease.normalized_name}.",
            )

    # ------------------------------------------------------------------ #

    async def _build_target_insight(
        self,
        target: Target,
        docking_results: list[DockingResult],
        disease: Disease,
    ) -> TargetInsight:
        """Generate biological insight for a single target, enriched with arXiv papers."""
        top_mols = docking_results[:3]
        top_mol_info = "\n".join(
            f"  - {r.molecule.smiles} (ΔG = {r.binding_affinity_kcal:.1f} kcal/mol)"
            for r in top_mols
        )

        # Fetch target-specific arXiv papers concurrently with the Claude call
        arxiv_task = asyncio.create_task(
            arxiv_client.search_for_target(target.gene_symbol, disease.normalized_name)
        )

        prompt = f"""Disease: {disease.normalized_name}
Target: {target.protein_name} ({target.gene_symbol}, UniProt: {target.uniprot_id})
Function: {target.function_summary[:400]}
Pathways: {', '.join(p.name for p in target.pathways[:3])}

Top docking candidates:
{top_mol_info if top_mol_info else "No docking results available"}

Write:
1. mechanism_of_action: How inhibiting/modulating this target would treat the disease (3-4 sentences)
2. pathway_relevance: Which disease pathways are affected and why that matters (2-3 sentences)
3. clinical_context: Current drugs targeting this protein, clinical stage, unmet needs (2-3 sentences)

Return JSON:
{{
  "mechanism_of_action": "...",
  "pathway_relevance": "...",
  "clinical_context": "..."
}}"""

        if settings.demo_mode:
            arxiv_task.cancel()
            return TargetInsight(
                target_gene=target.gene_symbol,
                mechanism_of_action=target.function_summary[:300] or f"Modulation of {target.gene_symbol} activity to address {disease.normalized_name}.",
                pathway_relevance=", ".join(p.name for p in target.pathways[:3]) or "Pathway data unavailable in demo mode.",
                clinical_context=f"{target.gene_symbol} is a validated target with druggability score {target.druggability_score:.2f}.",
                top_molecules=top_mols,
                arxiv_papers=[],
                pathway_graph=target.pathway_graph,
            )

        try:
            response, arxiv_raw = await asyncio.gather(
                self.ask_claude_json(
                    system=SYSTEM_SYNTHESIS,
                    prompt=prompt,
                    max_tokens=1024,
                ),
                arxiv_task,
            )
            papers = [
                ArXivPaper(
                    arxiv_id=p["arxiv_id"],
                    title=p["title"],
                    authors=p["authors"],
                    summary=p["summary"],
                    published=p["published"],
                    url=p["url"],
                    categories=p["categories"],
                )
                for p in arxiv_raw
            ]
            return TargetInsight(
                target_gene=target.gene_symbol,
                mechanism_of_action=response.get("mechanism_of_action", ""),
                pathway_relevance=response.get("pathway_relevance", ""),
                clinical_context=response.get("clinical_context", ""),
                top_molecules=top_mols,
                arxiv_papers=papers,
                pathway_graph=target.pathway_graph,
            )
        except Exception as e:
            self.logger.warning(f"Target insight generation failed for {target.gene_symbol}: {e}")
            return TargetInsight(
                target_gene=target.gene_symbol,
                mechanism_of_action=target.function_summary[:200],
                pathway_relevance="Pathway analysis unavailable.",
                clinical_context="Clinical context unavailable.",
                top_molecules=top_mols,
                arxiv_papers=[],
                pathway_graph=target.pathway_graph,
            )

    async def _generate_executive_summary(
        self,
        disease: Disease,
        top_candidates: list[DockingResult],
        target_insights: list[TargetInsight],
        total_generated: int,
        total_docked: int,
        arxiv_papers: list[ArXivPaper] | None = None,
    ) -> str:
        """Generate a multi-paragraph executive summary of the entire run."""
        targets_summary = "\n".join(
            f"- {t.target_gene}: {t.mechanism_of_action[:150]}"
            for t in target_insights[:5]
        )
        top_hit_info = ""
        if top_candidates:
            best = top_candidates[0]
            top_hit_info = (
                f"Best candidate: SMILES={best.molecule.smiles}, "
                f"ΔG={best.binding_affinity_kcal:.1f} kcal/mol "
                f"against {best.target_uniprot_id}"
            )

        # Build arXiv context block
        arxiv_block = ""
        if arxiv_papers:
            paper_lines = "\n".join(
                f"- [{p.published}] {p.title} — {p.summary[:200]}"
                for p in arxiv_papers[:3]
            )
            arxiv_block = f"\nRecent arXiv preprints on this disease:\n{paper_lines}"

        prompt = f"""Write a compelling 4-5 paragraph executive summary for this drug discovery run.

Disease: {disease.normalized_name}
Disease description: {disease.description}

Targets identified and their mechanisms:
{targets_summary}

Pipeline statistics:
- Molecules generated: {total_generated}
- Molecules docked: {total_docked}
- {top_hit_info}
{arxiv_block}

The summary should:
1. Open with disease significance and unmet medical need
2. Describe the computational approach taken
3. Highlight the most promising targets and why
4. Describe the top molecular candidates and predicted mechanism
5. Close with next steps (in vitro validation, analog synthesis, etc.)

Write in a professional, scientific tone suitable for a drug discovery report."""

        if settings.demo_mode:
            targets_str = ", ".join(t.target_gene for t in target_insights[:3])
            best = top_candidates[0] if top_candidates else None
            best_str = f"Top candidate achieved ΔG = {best.binding_affinity_kcal:.1f} kcal/mol against {best.target_uniprot_id}. " if best else ""
            return (
                f"{disease.normalized_name} represents a significant therapeutic challenge with substantial unmet medical need. "
                f"The Genesis pipeline identified {len(disease.targets)} prioritised therapeutic targets ({targets_str}) "
                f"through integrated disease-gene association analysis and druggability scoring.\n\n"
                f"{total_generated} candidate molecules were generated and {total_docked} docking complexes evaluated. "
                f"{best_str}"
                f"Lead candidates were selected based on binding affinity, Lipinski compliance, and predicted ADMET profiles.\n\n"
                f"Recommended next steps include in vitro target engagement assays, Caco-2 permeability screening, "
                f"and CYP450 metabolic stability profiling for the top scaffold series."
            )

        try:
            return await self.ask_claude(
                system=SYSTEM_SYNTHESIS,
                prompt=prompt,
                max_tokens=1500,
            )
        except Exception as e:
            self.logger.warning(f"Executive summary generation failed: {e}")
            return (
                f"Genesis identified {len(disease.targets)} therapeutic targets for "
                f"{disease.normalized_name} and screened {total_generated} candidate molecules, "
                f"resulting in {total_docked} docked complexes."
            )

    def _collect_safety_flags(self, libraries: list[MoleculeLibrary]) -> list[str]:
        """Collect safety concerns from molecular libraries."""
        flags = []
        pains_count = sum(
            1 for lib in libraries
            for mol in lib.molecules
            if mol.admet.has_pains
        )
        alerts_count = sum(
            1 for lib in libraries
            for mol in lib.molecules
            if mol.admet.has_alerts
        )
        if pains_count > 0:
            flags.append(
                f"{pains_count} molecules contain PAINS (Pan-Assay INterference compoundS) substructures — "
                "may produce false positives in biochemical assays."
            )
        if alerts_count > 0:
            flags.append(
                f"{alerts_count} molecules contain structural alerts (Brenk filter) — "
                "potential for reactivity or metabolic liability."
            )
        # SA score warnings
        high_sa = sum(
            1 for lib in libraries
            for mol in lib.molecules
            if mol.admet.synthetic_accessibility is not None
            and mol.admet.synthetic_accessibility > 5
        )
        if high_sa > 0:
            flags.append(
                f"{high_sa} molecules have synthetic accessibility score > 5 — "
                "may be difficult to synthesize without expert chemistry."
            )
        return flags

    def _identify_limitations(
        self,
        disease: Disease,
        libraries: list[MoleculeLibrary],
        docking_results: dict[str, list[DockingResult]],
    ) -> list[str]:
        """Document pipeline limitations for scientific transparency."""
        limitations = [
            "Docking scores are predicted values — experimental validation (SPR, ITC, enzymatic assays) required.",
            "ADMET predictions use 2D descriptors; metabolic stability and in vivo PK require experimental confirmation.",
            "Protein flexibility not modeled in rigid docking — induced fit effects may alter binding poses.",
            "Molecular generation uses heuristic methods; ML-based generative models may produce more novel scaffolds.",
        ]
        no_structure_targets = [
            t.gene_symbol for t in disease.targets if not t.pdb_local_path
        ]
        if no_structure_targets:
            limitations.append(
                f"No PDB structure available for: {', '.join(no_structure_targets)} — "
                "binding affinities estimated from molecular properties only."
            )
        return limitations

    def _methodology_notes(self) -> str:
        return (
            "Targets identified via DisGeNET disease-gene associations, validated against UniProt. "
            "Protein structures retrieved from RCSB PDB. "
            "Molecules generated using scaffold decoration and fragment-based approaches (RDKit). "
            "ADMET filtering via Lipinski Ro5, PAINS, and Brenk structural alerts. "
            "Docking performed with AutoDock Vina. "
            "Interaction analysis and narrative generation via Anthropic Claude API."
        )
