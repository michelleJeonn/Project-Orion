"""
ADMET / Drug-likeness filters using RDKit.
Implements Lipinski Ro5, Veber rules, PAINS, and structural alerts.
"""
from typing import Optional

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, QED, AllChem, rdMolDescriptors
    from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

from backend.models.molecule import ADMETProfile
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# PAINS and structural alert catalogs (initialized once)
_PAINS_CATALOG: Optional[object] = None
_ALERTS_CATALOG: Optional[object] = None


def _get_pains_catalog():
    global _PAINS_CATALOG
    if _PAINS_CATALOG is None and RDKIT_AVAILABLE:
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
        _PAINS_CATALOG = FilterCatalog(params)
    return _PAINS_CATALOG


def _get_alerts_catalog():
    global _ALERTS_CATALOG
    if _ALERTS_CATALOG is None and RDKIT_AVAILABLE:
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.BRENK)
        _ALERTS_CATALOG = FilterCatalog(params)
    return _ALERTS_CATALOG


def compute_admet(smiles: str) -> Optional[ADMETProfile]:
    """Compute ADMET profile for a SMILES string. Returns None if invalid."""
    if not RDKIT_AVAILABLE:
        logger.warning("RDKit not available — skipping ADMET computation")
        return ADMETProfile()

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    mw = Descriptors.ExactMolWt(mol)
    log_p = Descriptors.MolLogP(mol)
    hbd = rdMolDescriptors.CalcNumHBD(mol)
    hba = rdMolDescriptors.CalcNumHBA(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    rot = rdMolDescriptors.CalcNumRotatableBonds(mol)

    # Lipinski Rule of Five
    lipinski_pass = (
        mw <= 500
        and log_p <= 5
        and hbd <= 5
        and hba <= 10
    )

    # QED (0-1, 1 = most drug-like)
    try:
        qed = QED.qed(mol)
    except Exception:
        qed = None

    # Synthetic accessibility (approximated via ring count + complexity)
    try:
        from rdkit.Chem import RDConfig
        import os, sys
        sa_path = os.path.join(RDConfig.RDContribDir, "SA_Score")
        if sa_path not in sys.path:
            sys.path.insert(0, sa_path)
        import sascorer
        sa_score = sascorer.calculateScore(mol)
    except Exception:
        # Fallback: estimate from ring count and heavy atom count
        ring_count = rdMolDescriptors.CalcNumRings(mol)
        heavy_atoms = mol.GetNumHeavyAtoms()
        sa_score = 1.0 + min(ring_count * 0.5 + heavy_atoms * 0.02, 9.0)

    # PAINS check
    has_pains = False
    pains_cat = _get_pains_catalog()
    if pains_cat:
        has_pains = pains_cat.HasMatch(mol)

    # Structural alerts (Brenk)
    has_alerts = False
    alerts_cat = _get_alerts_catalog()
    if alerts_cat:
        has_alerts = alerts_cat.HasMatch(mol)

    return ADMETProfile(
        mw=round(mw, 2),
        log_p=round(log_p, 2),
        hbd=hbd,
        hba=hba,
        tpsa=round(tpsa, 2),
        rotatable_bonds=rot,
        lipinski_pass=lipinski_pass,
        qed_score=round(qed, 3) if qed is not None else None,
        synthetic_accessibility=round(sa_score, 2),
        has_pains=has_pains,
        has_alerts=has_alerts,
    )


def passes_drug_likeness(admet: ADMETProfile, strict: bool = False) -> bool:
    """
    Returns True if molecule passes drug-likeness filters.
    strict=True applies Veber rules (TPSA < 140, rotatable bonds ≤ 10).
    """
    if not admet.lipinski_pass:
        return False
    if admet.has_pains:
        return False
    if admet.synthetic_accessibility is not None and admet.synthetic_accessibility > 6:
        return False
    if strict:
        if admet.tpsa is not None and admet.tpsa > 140:
            return False
        if admet.rotatable_bonds is not None and admet.rotatable_bonds > 10:
            return False
    return True


def compute_tanimoto(smiles1: str, smiles2: str) -> float:
    """Compute Tanimoto similarity between two SMILES strings."""
    if not RDKIT_AVAILABLE:
        return 0.0
    mol1 = Chem.MolFromSmiles(smiles1)
    mol2 = Chem.MolFromSmiles(smiles2)
    if mol1 is None or mol2 is None:
        return 0.0
    fp1 = AllChem.GetMorganFingerprintAsBitVect(mol1, 2, 2048)
    fp2 = AllChem.GetMorganFingerprintAsBitVect(mol2, 2, 2048)
    from rdkit import DataStructs
    return DataStructs.TanimotoSimilarity(fp1, fp2)


def cluster_by_diversity(smiles_list: list[str], max_clusters: int = 10) -> dict[int, list[int]]:
    """
    Cluster molecules by Tanimoto similarity using leader clustering.
    Returns {cluster_id: [indices]}.
    """
    if not RDKIT_AVAILABLE or not smiles_list:
        return {0: list(range(len(smiles_list)))}

    from rdkit.Chem import AllChem
    from rdkit import DataStructs

    fps = []
    valid_indices = []
    for i, smi in enumerate(smiles_list):
        mol = Chem.MolFromSmiles(smi)
        if mol:
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, 2048)
            fps.append(fp)
            valid_indices.append(i)

    if not fps:
        return {0: list(range(len(smiles_list)))}

    # Butina clustering (leader algorithm)
    from rdkit.ML.Cluster import Butina
    dists = []
    for i in range(1, len(fps)):
        sims = DataStructs.BulkTanimotoSimilarity(fps[i], fps[:i])
        dists.extend([1 - s for s in sims])

    clusters_raw = Butina.ClusterData(dists, len(fps), 0.4, isDistData=True)
    clusters = {}
    for cluster_id, indices in enumerate(clusters_raw):
        clusters[cluster_id] = [valid_indices[i] for i in indices]
    return clusters
