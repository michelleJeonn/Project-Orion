from pydantic import BaseModel, Field
from typing import Optional


class ADMETProfile(BaseModel):
    # Absorption
    log_p: Optional[float] = None           # lipophilicity (ideally -0.4 to 5.6)
    tpsa: Optional[float] = None            # topological polar surface area (< 140 Å²)
    hbd: Optional[int] = None               # H-bond donors (≤ 5)
    hba: Optional[int] = None               # H-bond acceptors (≤ 10)
    # Drug-likeness
    mw: Optional[float] = None              # molecular weight (< 500 Da)
    rotatable_bonds: Optional[int] = None   # (≤ 10)
    lipinski_pass: bool = False
    qed_score: Optional[float] = None       # quantitative estimate of drug-likeness 0-1
    # Toxicity flags
    has_pains: bool = False                 # pan-assay interference compounds
    has_alerts: bool = False                # structural alerts (mutagenicity, reactivity)
    synthetic_accessibility: Optional[float] = None  # SA score 1 (easy) – 10 (hard)


class ParetoObjectives(BaseModel):
    """All 6 multi-objective scores, normalized 0-1 (higher = better)."""
    binding_affinity: float = 0.5        # from docking ΔG
    selectivity: float = 0.5             # structural proxy (Fsp3, PAINS, aromatic density)
    bbb_penetration: float = 0.5         # Egan/CNS-MPO heuristic
    metabolic_stability: float = 0.5     # CYP/hydrolysis heuristics
    oral_absorption: float = 0.5         # Lipinski + Veber
    synthetic_accessibility: float = 0.5 # inverted SA score
    pareto_rank: int = 1                 # 1 = Pareto front
    weighted_score: float = 0.5          # Claude-weighted composite


class ObjectiveWeights(BaseModel):
    """Disease-context weights assigned by Claude. Must sum to ~1.0."""
    binding_affinity: float = 0.30
    selectivity: float = 0.20
    bbb_penetration: float = 0.10
    metabolic_stability: float = 0.20
    oral_absorption: float = 0.10
    synthetic_accessibility: float = 0.10
    rationale: str = ""


class Molecule(BaseModel):
    smiles: str
    molecule_id: str = ""
    name: Optional[str] = None
    inchi_key: Optional[str] = None
    # 3D
    mol_block: Optional[str] = None         # MOL/SDF block for 3D conformer
    conformer_path: Optional[str] = None    # path to .sdf or .pdbqt
    # Properties
    admet: ADMETProfile = Field(default_factory=ADMETProfile)
    # Multi-objective optimization
    pareto_objectives: Optional[ParetoObjectives] = None
    # Origin
    generation_method: str = ""             # e.g. "fragment_linking", "scaffold_decoration"
    scaffold_smiles: Optional[str] = None
    # Similarity
    tanimoto_to_known: Optional[float] = None
    nearest_known_drug: Optional[str] = None
    # Ranking
    diversity_cluster: Optional[int] = None
    rank: Optional[int] = None


class MoleculeLibrary(BaseModel):
    target_uniprot_id: str
    molecules: list[Molecule] = []
    generation_params: dict = {}
    total_generated: int = 0
    total_passed_filters: int = 0
