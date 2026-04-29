from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime
from backend.models.molecule import ObjectiveWeights


class ArXivPaper(BaseModel):
    arxiv_id: str
    title: str
    authors: list[str] = []
    summary: str = ""
    published: str = ""          # YYYY-MM-DD
    url: str
    categories: list[str] = []


class PipelineStage(str, Enum):
    QUEUED = "queued"
    DISEASE_ANALYSIS = "disease_analysis"
    TARGET_DISCOVERY = "target_discovery"
    MOLECULAR_GENERATION = "molecular_generation"
    DOCKING = "docking"
    INSIGHT_SYNTHESIS = "insight_synthesis"
    COMPLETED = "completed"
    FAILED = "failed"


class PipelineStatus(BaseModel):
    job_id: str
    stage: PipelineStage = PipelineStage.QUEUED
    progress: int = Field(ge=0, le=100, default=0)   # 0-100 %
    message: str = ""
    started_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = None


class DockingInteraction(BaseModel):
    residue: str            # e.g. "ASP189"
    interaction_type: str   # "H-bond", "Hydrophobic", "Pi-stacking", "Ionic"
    distance_angstrom: Optional[float] = None


class DockingResult(BaseModel):
    molecule: "Molecule"  # forward ref resolved in report
    target_uniprot_id: str
    pdb_id: str
    binding_affinity_kcal: float        # more negative = stronger
    rmsd_lb: Optional[float] = None     # RMSD lower bound from Vina
    rmsd_ub: Optional[float] = None     # RMSD upper bound from Vina
    pose_path: Optional[str] = None     # full local path to docked pose file
    pose_file: Optional[str] = None     # filename only — served via /api/structure/{pose_file}
    protein_structure_file: Optional[str] = None  # PDB filename for 3D viewer
    docking_method: str = "vina"        # "vina" or "diffdock"
    interactions: list[DockingInteraction] = []
    rank: int = 0
    explanation: str = ""               # Claude-generated interaction narrative


class TargetInsight(BaseModel):
    target_gene: str
    mechanism_of_action: str
    pathway_relevance: str
    clinical_context: str
    top_molecules: list["DockingResult"] = []
    arxiv_papers: list[ArXivPaper] = []
    pathway_graph: Optional[dict] = None   # {nodes, edges} from KEGG/Reactome


class ParetoAnalysis(BaseModel):
    """Summary of multi-objective Pareto optimization results."""
    weights: ObjectiveWeights
    pareto_front_count: int = 0          # molecules on the first Pareto front
    disease_context: str = ""            # Claude's explanation of weight choices
    is_neurological: bool = False        # whether BBB penetration was prioritized


class CryosisReport(BaseModel):
    job_id: str
    disease_query: str
    disease_name: str
    disease_description: str
    mondo_id: Optional[str] = None
    do_id: Optional[str] = None
    affected_genes: list[str] = []
    executive_summary: str
    targets_analyzed: int
    molecules_generated: int
    molecules_docked: int
    target_insights: list[TargetInsight] = []
    top_candidates: list["DockingResult"] = []
    safety_flags: list[str] = []
    limitations: list[str] = []
    methodology_notes: str = ""
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    pipeline_duration_seconds: Optional[float] = None
    arxiv_papers: list[ArXivPaper] = []   # global disease-level preprints
    pareto_analysis: Optional[ParetoAnalysis] = None


class PipelineJob(BaseModel):
    job_id: str
    disease_query: str
    status: PipelineStatus
    report: Optional[CryosisReport] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Resolve forward references
from backend.models.molecule import Molecule  # noqa: E402
DockingResult.model_rebuild()
CryosisReport.model_rebuild()
TargetInsight.model_rebuild()
ParetoAnalysis.model_rebuild()
