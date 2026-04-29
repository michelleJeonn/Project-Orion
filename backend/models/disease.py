from pydantic import BaseModel, Field
from typing import Optional


class TargetEvidence(BaseModel):
    source: str                         # e.g. "DisGeNET", "UniProt", "PubMed"
    score: float = Field(ge=0.0, le=1.0)
    pmids: list[str] = []
    description: str = ""


class Pathway(BaseModel):
    pathway_id: str                     # e.g. "hsa05010"
    name: str
    database: str                       # e.g. "KEGG", "Reactome"
    url: str = ""


class Target(BaseModel):
    gene_symbol: str
    protein_name: str
    uniprot_id: str
    pdb_ids: list[str] = []
    preferred_pdb_id: Optional[str] = None
    pdb_local_path: Optional[str] = None    # downloaded .pdb file path
    organism: str = "Homo sapiens"
    function_summary: str = ""
    pathways: list[Pathway] = []
    evidence: list[TargetEvidence] = []
    druggability_score: float = 0.0         # 0-1, higher = more druggable
    clinical_relevance_score: float = 0.0   # 0-1
    overall_score: float = 0.0              # composite ranking score
    binding_site_residues: list[str] = []   # e.g. ["ASP189", "SER190"]
    binding_site_center: Optional[tuple[float, float, float]] = None
    binding_site_size: tuple[float, float, float] = (20.0, 20.0, 20.0)
    pathway_graph: Optional[dict] = None   # {nodes, edges} from KEGG/Reactome


class Disease(BaseModel):
    query: str                          # raw user input
    normalized_name: str
    mondo_id: Optional[str] = None
    do_id: Optional[str] = None
    description: str = ""
    affected_genes: list[str] = []
    targets: list[Target] = []
    context_summary: str = ""           # Claude-generated disease overview
