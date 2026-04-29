"""
Disease Intelligence Agent
Maps a natural-language disease query to validated, druggable protein targets.
"""
import asyncio
from typing import Optional

from backend.agents.base_agent import BaseAgent
from backend.models.disease import Disease, Target, TargetEvidence, Pathway
from backend.services.pubmed import pubmed_client
from backend.services.uniprot import uniprot_client
from backend.services.pdb_service import pdb_client
from backend.services.alphafold import alphafold_client
from backend.services.chembl import chembl_client
from backend.services.disgenet import disgenet_client
from backend.services.pathway_graph import get_pathway_graph
from backend.config import settings


SYSTEM_DISEASE = """You are an expert biomedical scientist specializing in drug target identification.
Your role is to analyze disease queries and identify the most promising therapeutic targets.
Always base recommendations on published evidence. Be precise with gene symbols and UniProt IDs."""


class DiseaseIntelligenceAgent(BaseAgent):
    async def discover_targets(
        self,
        disease_query: str,
        progress_callback=None,
    ) -> Disease:
        """
        Full disease → target pipeline.
        Returns a Disease object with ranked, annotated targets.
        """
        self.logger.info(f"Starting disease analysis: {disease_query}")

        if settings.demo_mode:
            return await self._discover_targets_demo(disease_query, progress_callback)

        # Step 1: Parse and normalize the disease query with Claude
        if progress_callback:
            await progress_callback("Parsing disease query with AI...", 5)
        disease = await self._parse_disease_query(disease_query)
        self.logger.info(f"[DEBUG] Normalized name: '{disease.normalized_name}'")
        self.logger.info(f"[DEBUG] Claude affected_genes: {disease.affected_genes}")

        # Step 2: Query DisGeNET for gene-disease associations
        if progress_callback:
            await progress_callback("Querying disease-gene databases...", 15)
        gda_list = await disgenet_client.get_genes_for_disease(
            disease.normalized_name, min_score=0.06, max_results=30
        )
        self.logger.info(f"[DEBUG] DisGeNET returned {len(gda_list)} associations: {[g['gene_symbol'] for g in gda_list[:10]]}")

        # Step 3: Get Claude to identify top druggable targets
        if progress_callback:
            await progress_callback("Identifying druggable targets with AI...", 25)
        target_gene_list = await self._identify_druggable_targets(
            disease, gda_list
        )
        self.logger.info(f"[DEBUG] Claude selected {len(target_gene_list)} targets: {[t.get('gene_symbol') for t in target_gene_list]}")

        # Step 4: Fetch UniProt + PDB data for each candidate target
        if progress_callback:
            await progress_callback("Fetching protein structures and annotations...", 35)
        targets = await self._enrich_targets(target_gene_list, disease)
        self.logger.info(f"[DEBUG] Enrichment succeeded for {len(targets)}/{len(target_gene_list)} targets")

        # Step 5: Score and rank
        targets = self._rank_targets(targets)
        disease.targets = targets[: settings.max_targets]

        # Step 6: Generate disease context summary
        if progress_callback:
            await progress_callback("Generating disease context summary...", 45)
        disease.context_summary = await self._generate_disease_summary(disease)

        self.logger.info(
            f"Disease analysis complete: {len(disease.targets)} targets identified"
        )
        return disease

    async def _discover_targets_demo(
        self,
        disease_query: str,
        progress_callback=None,
    ) -> Disease:
        """
        Fast demo path: uses only Claude (no external API calls).
        Skips DisGeNET, UniProt, PDB, and AlphaFold to finish in seconds.
        """
        self.logger.info(f"[DEMO] Running demo disease analysis for: {disease_query}")

        if progress_callback:
            await progress_callback("[Demo] Parsing disease query with AI...", 10)
        disease = await self._parse_disease_query(disease_query)

        if progress_callback:
            await progress_callback("[Demo] Identifying druggable targets with AI...", 25)
        target_gene_list = await self._identify_druggable_targets(disease, gda_list=[])
        target_gene_list = target_gene_list[: settings.demo_max_targets]
        self.logger.info(f"[DEMO] Claude selected targets: {[t.get('gene_symbol') for t in target_gene_list]}")

        # Build lightweight Target objects directly — no API calls
        targets = []
        for t in target_gene_list:
            gene = t.get("gene_symbol", "")
            if not gene:
                continue
            target = Target(
                gene_symbol=gene,
                protein_name=t.get("protein_name", gene),
                uniprot_id=gene,          # placeholder; no UniProt call
                function_summary=t.get("rationale", ""),
                druggability_score=float(t.get("druggability_score", 0.8)),
                clinical_relevance_score=float(t.get("clinical_relevance_score", 0.8)),
                evidence=[TargetEvidence(
                    source="Claude",
                    score=float(t.get("druggability_score", 0.8)),
                    description=t.get("rationale", ""),
                )],
            )
            target.overall_score = (target.druggability_score + target.clinical_relevance_score) / 2
            targets.append(target)

        disease.targets = self._rank_targets(targets)

        if progress_callback:
            await progress_callback("[Demo] Generating disease context summary...", 45)
        disease.context_summary = await self._generate_disease_summary(disease)

        self.logger.info(f"[DEMO] Disease analysis complete: {len(disease.targets)} targets")
        return disease

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    async def _parse_disease_query(self, query: str) -> Disease:
        """Use Claude to normalize the disease name and extract context."""
        result = await self.ask_claude_json(
            system=SYSTEM_DISEASE,
            prompt=f"""Parse this disease query and return a JSON object with these fields:
- normalized_name: standardized disease name (e.g. "Alzheimer's disease")
- mondo_id: MONDO ontology ID if you know it (e.g. "MONDO:0004975"), or null
- do_id: Disease Ontology ID if known (e.g. "DOID:10652"), or null
- description: 2-3 sentence description of the disease
- affected_genes: list of up to 15 well-known associated gene symbols (strings)

Disease query: "{query}"

Respond ONLY with the JSON object.""",
            max_tokens=1024,
        )
        return Disease(
            query=query,
            normalized_name=result.get("normalized_name", query),
            mondo_id=result.get("mondo_id"),
            do_id=result.get("do_id"),
            description=result.get("description", ""),
            affected_genes=result.get("affected_genes", []),
        )

    async def _identify_druggable_targets(
        self, disease: Disease, gda_list: list[dict]
    ) -> list[dict]:
        """
        Ask Claude to select the top druggable targets from combined evidence.
        Returns list of {gene_symbol, rationale, druggability_score, clinical_relevance_score}.
        """
        # Combine DisGeNET genes with Claude's initial list
        disgenet_genes = [g["gene_symbol"] for g in gda_list[:20] if g.get("gene_symbol")]
        all_genes = list(dict.fromkeys(disease.affected_genes + disgenet_genes))  # preserve order, dedupe

        if not all_genes:
            # Fallback: ask Claude for well-known targets
            all_genes = disease.affected_genes or []

        prompt = f"""Disease: {disease.normalized_name}
Description: {disease.description}

Candidate genes from databases: {', '.join(all_genes[:30])}

Select up to {settings.max_targets} of the most promising DRUGGABLE protein targets for this disease.
Prioritize targets that are:
1. Enzymes, receptors, or ion channels (not transcription factors or structural proteins)
2. Validated by clinical evidence or approved drugs
3. Have known 3D structures in PDB
4. Represent diverse therapeutic mechanisms

Return a JSON array of objects, each with:
- gene_symbol: official HGNC symbol (string)
- protein_name: full protein name (string)
- rationale: 1-2 sentence scientific rationale (string)
- druggability_score: float 0-1 (1 = highly druggable)
- clinical_relevance_score: float 0-1

Example:
[{{"gene_symbol": "BACE1", "protein_name": "Beta-secretase 1", "rationale": "...", "druggability_score": 0.9, "clinical_relevance_score": 0.95}}]"""

        try:
            targets_raw = await self.ask_claude_json(
                system=SYSTEM_DISEASE,
                prompt=prompt,
                max_tokens=2048,
            )
            if isinstance(targets_raw, list) and targets_raw:
                return targets_raw
        except Exception as e:
            self.logger.warning(f"Claude target identification failed: {e}")

        # Fallback 1: use top DisGeNET genes
        if gda_list:
            return [
                {
                    "gene_symbol": g["gene_symbol"],
                    "protein_name": g["gene_symbol"],
                    "rationale": f"Associated with {disease.normalized_name} (DisGeNET score: {g['score']:.2f})",
                    "druggability_score": min(g["score"] * 1.5, 1.0),
                    "clinical_relevance_score": g["score"],
                }
                for g in gda_list[:settings.max_targets]
                if g.get("gene_symbol")
            ]

        # Fallback 2: ask Claude directly without database results
        self.logger.info(f"No database results for '{disease.normalized_name}', using Claude knowledge fallback")
        try:
            fallback_prompt = f"""Disease: {disease.normalized_name}
Description: {disease.description}

No database results are available. Using your biomedical knowledge, identify up to {settings.max_targets} well-validated, druggable protein targets for this disease.
Prioritize targets with approved drugs or active clinical trials, known 3D structures, and strong mechanistic rationale.

Return a JSON array of objects, each with:
- gene_symbol: official HGNC symbol (string)
- protein_name: full protein name (string)
- rationale: 1-2 sentence scientific rationale (string)
- druggability_score: float 0-1 (1 = highly druggable)
- clinical_relevance_score: float 0-1"""
            fallback_raw = await self.ask_claude_json(
                system=SYSTEM_DISEASE,
                prompt=fallback_prompt,
                max_tokens=2048,
            )
            if isinstance(fallback_raw, list) and fallback_raw:
                return fallback_raw
        except Exception as e:
            self.logger.warning(f"Claude fallback target identification failed: {e}")

        return []

    async def _enrich_targets(
        self, target_list: list[dict], disease: Disease
    ) -> list[Target]:
        """Fetch UniProt + PDB data for each target in parallel."""
        tasks = [self._enrich_single_target(t, disease) for t in target_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        targets = []
        for r in results:
            if isinstance(r, Exception):
                self.logger.warning(f"Target enrichment error: {r}")
            elif r is not None:
                targets.append(r)
        return targets

    async def _enrich_single_target(
        self, target_info: dict, disease: Disease
    ) -> Optional[Target]:
        gene = target_info.get("gene_symbol", "")
        if not gene:
            return None

        # Fetch UniProt
        uniprot_results = await uniprot_client.search_by_gene(gene)
        if not uniprot_results:
            # Try without reviewed filter
            uniprot_results = await uniprot_client.search_by_gene(gene, reviewed_only=False)
        if not uniprot_results:
            self.logger.warning(f"No UniProt entry found for {gene}")
            return None

        entry = uniprot_results[0]
        accession = entry.get("primaryAccession", "")
        # Fetch full entry for cross-references
        full_entry = await uniprot_client.get_by_accession(accession)
        pdb_ids = uniprot_client.extract_pdb_ids(full_entry) if full_entry else []
        function = uniprot_client.extract_function(full_entry) if full_entry else ""
        pathways_raw = uniprot_client.extract_pathways(full_entry) if full_entry else []

        # Select best PDB structure
        best_pdb = await pdb_client.select_best_pdb(pdb_ids)

        # Download PDB structure; fall back to AlphaFold predicted structure
        pdb_local: Optional[str] = None
        if best_pdb:
            try:
                pdb_local = await pdb_client.download_pdb(best_pdb)
            except Exception as e:
                self.logger.warning(f"PDB download failed for {best_pdb}: {e}")

        if not pdb_local and accession:
            self.logger.info(f"No experimental PDB for {gene} — trying AlphaFold")
            pdb_local = await alphafold_client.get_structure(accession)

        # Build pathways
        pathways = [
            Pathway(pathway_id="", name=p["name"], database=p["database"])
            for p in pathways_raw
        ]

        # Build evidence
        evidence = [
            TargetEvidence(
                source="Claude/DisGeNET",
                score=float(target_info.get("druggability_score", 0.5)),
                description=target_info.get("rationale", ""),
            )
        ]

        # Protein name
        protein_desc = entry.get("proteinDescription", {})
        rec_name = protein_desc.get("recommendedName", {})
        full_name = rec_name.get("fullName", {}).get("value", target_info.get("protein_name", gene))

        target = Target(
            gene_symbol=gene,
            protein_name=full_name,
            uniprot_id=accession,
            pdb_ids=pdb_ids[:10],
            preferred_pdb_id=best_pdb,
            pdb_local_path=pdb_local,
            function_summary=function[:500] if function else "",
            pathways=pathways[:5],
            evidence=evidence,
            druggability_score=float(target_info.get("druggability_score", 0.5)),
            clinical_relevance_score=float(target_info.get("clinical_relevance_score", 0.5)),
        )
        target.overall_score = (target.druggability_score + target.clinical_relevance_score) / 2

        # Fetch real pathway graph (best-effort, non-blocking on failure)
        try:
            target.pathway_graph = await get_pathway_graph(gene, accession)
        except Exception as e:
            self.logger.warning(f"Pathway graph fetch failed for {gene}: {e}")

        return target

    def _rank_targets(self, targets: list[Target]) -> list[Target]:
        """Rank targets by overall_score descending."""
        return sorted(targets, key=lambda t: t.overall_score, reverse=True)

    async def _generate_disease_summary(self, disease: Disease) -> str:
        """Generate a concise disease + target context summary."""
        target_bullets = "\n".join(
            f"- {t.gene_symbol} ({t.protein_name}): {t.function_summary[:150]}"
            for t in disease.targets
        )
        summary = await self.ask_claude(
            system=SYSTEM_DISEASE,
            prompt=f"""Write a concise (3-5 paragraph) scientific overview of {disease.normalized_name}
for a drug discovery report. Include:
1. Disease mechanism and pathophysiology
2. Current treatment landscape and unmet needs
3. Why the following targets were selected:
{target_bullets}

Be precise, cite mechanism not just names. Write for a medicinal chemistry audience.""",
            max_tokens=1024,
        )
        return summary
