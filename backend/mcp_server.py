"""
Cryosis MCP Server — optional tool-access layer for Claude agents.

Exposes the Cryosis pipeline as MCP tools so Claude (or any MCP client)
can call individual steps directly without going through the REST API.

Run standalone:
    python -m backend.mcp_server

The FastAPI server (main.py) does NOT import this module.
MCP is purely additive — the core app works without it.
"""

try:
    from fastmcp import FastMCP
except ImportError:
    raise SystemExit(
        "fastmcp is not installed.\n"
        "Install it with:  pip install fastmcp\n"
        "MCP is optional — the FastAPI server runs without it."
    )

from backend.services.disgenet import disgenet_client
from backend.services.uniprot import uniprot_client
from backend.services.pathway_graph import get_pathway_graph
from backend.agents.molecular_generation import MolecularGenerationAgent
from backend.agents.docking import DockingAgent
from backend.models.disease import Target
from backend.models.molecule import MoleculeLibrary, Molecule
from backend.molecular.filters import compute_admet

mcp = FastMCP("Cryosis Drug Discovery")

_molgen = MolecularGenerationAgent()
_docking = DockingAgent()


# ── Response helpers ───────────────────────────────────────────────────── #

def _ok(data) -> dict:
    return {"ok": True, "data": data}


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


# ── Tools ──────────────────────────────────────────────────────────────── #

@mcp.tool()
async def search_disgenet(
    disease_name: str,
    min_score: float = 0.06,
    max_results: int = 20,
) -> dict:
    """
    Search DisGeNET for gene-disease associations.

    Returns a ranked list of genes associated with the disease,
    each with an evidence score and source databases.
    """
    try:
        results = await disgenet_client.get_genes_for_disease(
            disease_name, min_score=min_score, max_results=max_results
        )
        return _ok(results)
    except Exception as e:
        return _err(str(e))


@mcp.tool()
async def fetch_uniprot_target(gene_symbol: str) -> dict:
    """
    Fetch UniProt annotations for a human gene symbol.

    Returns the UniProt accession, protein function summary,
    associated PDB structure IDs, and biological pathways.
    """
    try:
        results = await uniprot_client.search_by_gene(gene_symbol)
        if not results:
            return _err(f"No UniProt entry found for gene: {gene_symbol}")

        entry = results[0]
        accession = entry.get("primaryAccession", "")
        full = await uniprot_client.get_by_accession(accession)

        return _ok({
            "accession": accession,
            "gene_symbol": gene_symbol,
            "protein_name": (
                entry.get("proteinDescription", {})
                     .get("recommendedName", {})
                     .get("fullName", {})
                     .get("value", gene_symbol)
            ),
            "function": uniprot_client.extract_function(full) if full else "",
            "pdb_ids": uniprot_client.extract_pdb_ids(full) if full else [],
            "pathways": uniprot_client.extract_pathways(full) if full else [],
        })
    except Exception as e:
        return _err(str(e))


@mcp.tool()
async def fetch_pathway_graph(
    gene_symbol: str,
    uniprot_id: str = "",
) -> dict:
    """
    Fetch a KEGG or Reactome pathway graph for a gene.

    Returns a graph with typed nodes (driver, protein, compound, outcome)
    and directed edges (direct or indirect). Use this to understand which
    biological pathways a target sits in and how it connects to disease outcomes.
    """
    try:
        graph = await get_pathway_graph(gene_symbol, uniprot_id)
        if not graph:
            return _err(f"No pathway data found for {gene_symbol}")
        return _ok(graph)
    except Exception as e:
        return _err(str(e))


@mcp.tool()
async def generate_molecules(
    gene_symbol: str,
    protein_name: str,
    uniprot_id: str = "",
    function_summary: str = "",
    n_molecules: int = 20,
) -> dict:
    """
    Generate drug-like small molecule candidates for a target protein.

    Uses scaffold decoration, fragment linking, and bioisostere replacement
    seeded by known ChEMBL actives. All candidates pass Lipinski Ro5, PAINS,
    and synthetic accessibility filters before being returned.
    """
    try:
        target = Target(
            gene_symbol=gene_symbol,
            protein_name=protein_name,
            uniprot_id=uniprot_id or gene_symbol,
            function_summary=function_summary,
        )
        library = await _molgen.generate_candidates(target, n_molecules=n_molecules)

        return _ok({
            "target": gene_symbol,
            "generated": library.total_generated,
            "passed_filters": library.total_passed_filters,
            "molecules": [
                {
                    "smiles": m.smiles,
                    "molecule_id": m.molecule_id,
                    "rank": m.rank,
                    "generation_method": m.generation_method,
                    "admet": {
                        "mw": m.admet.mw,
                        "log_p": m.admet.log_p,
                        "hbd": m.admet.hbd,
                        "hba": m.admet.hba,
                        "tpsa": m.admet.tpsa,
                        "qed_score": m.admet.qed_score,
                        "lipinski_pass": m.admet.lipinski_pass,
                        "synthetic_accessibility": m.admet.synthetic_accessibility,
                        "has_pains": m.admet.has_pains,
                    },
                }
                for m in library.molecules
            ],
        })
    except Exception as e:
        return _err(str(e))


@mcp.tool()
async def run_docking(
    gene_symbol: str,
    uniprot_id: str,
    smiles_list: list[str],
    pdb_local_path: str = "",
    preferred_pdb_id: str = "",
) -> dict:
    """
    Dock a list of SMILES strings against a target protein.

    If pdb_local_path is provided, uses AutoDock Vina for real docking.
    Without a structure file, returns mock scores derived from molecular
    properties (useful for ranking without a local Vina installation).

    Returns binding affinities (kcal/mol), predicted interactions, and
    Claude-generated mechanistic explanations for the top poses.
    """
    try:
        target = Target(
            gene_symbol=gene_symbol,
            protein_name=gene_symbol,
            uniprot_id=uniprot_id,
            pdb_local_path=pdb_local_path or None,
            preferred_pdb_id=preferred_pdb_id,
        )

        molecules: list[Molecule] = []
        for i, smi in enumerate(smiles_list[:50]):
            admet = compute_admet(smi)
            if admet is None:
                continue
            molecules.append(Molecule(
                smiles=smi,
                admet=admet,
                molecule_id=f"{gene_symbol}_{i+1:04d}",
                generation_method="mcp_input",
            ))

        if not molecules:
            return _err("No valid SMILES provided — all failed ADMET parsing")

        library = MoleculeLibrary(
            target_uniprot_id=uniprot_id,
            molecules=molecules,
            total_generated=len(smiles_list),
            total_passed_filters=len(molecules),
        )

        results = await _docking.run_docking(target, library, top_n=len(molecules))

        return _ok([
            {
                "rank": r.rank,
                "smiles": r.molecule.smiles,
                "binding_affinity_kcal": r.binding_affinity_kcal,
                "docking_method": r.docking_method,
                "rmsd_lb": r.rmsd_lb,
                "rmsd_ub": r.rmsd_ub,
                "interactions": [
                    {
                        "residue": i.residue,
                        "type": i.interaction_type,
                        "distance_angstrom": i.distance_angstrom,
                    }
                    for i in r.interactions
                ],
                "explanation": r.explanation,
            }
            for r in results
        ])
    except Exception as e:
        return _err(str(e))


@mcp.tool()
async def summarize_report(job_id: str) -> dict:
    """
    Retrieve and summarize a completed Cryosis pipeline report by job ID.

    Returns the executive summary, top drug candidates with binding affinities,
    safety flags, and pipeline statistics. The job must have completed
    successfully (check GET /api/jobs/{job_id} first if unsure).
    """
    try:
        from backend.db.session import AsyncSessionLocal
        from backend.db import crud
        from backend.models.report import CryosisReport

        async with AsyncSessionLocal() as db:
            job = await crud.get_job(db, job_id)

        if not job:
            return _err(f"Job {job_id} not found")
        if job.stage != "completed" or not job.result:
            return _err(f"Job {job_id} is not completed yet (stage: {job.stage})")

        report = CryosisReport.model_validate(job.result)

        return _ok({
            "job_id": job_id,
            "disease": report.disease_name,
            "targets_analyzed": report.targets_analyzed,
            "molecules_generated": report.molecules_generated,
            "molecules_docked": report.molecules_docked,
            "executive_summary": report.executive_summary,
            "top_candidates": [
                {
                    "rank": c.rank,
                    "smiles": c.molecule.smiles,
                    "target_uniprot_id": c.target_uniprot_id,
                    "binding_affinity_kcal": c.binding_affinity_kcal,
                    "docking_method": c.docking_method,
                    "qed_score": c.molecule.admet.qed_score,
                    "lipinski_pass": c.molecule.admet.lipinski_pass,
                }
                for c in report.top_candidates[:5]
            ],
            "safety_flags": report.safety_flags,
            "limitations": report.limitations,
        })
    except Exception as e:
        return _err(str(e))


# ── Entry point ────────────────────────────────────────────────────────── #

if __name__ == "__main__":
    mcp.run()
