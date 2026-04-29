"""
Multi-objective Pareto optimization for drug candidates.

Scores molecules across 6 objectives (all normalized 0-1, higher = better):
  binding_affinity  — from docking ΔG
  selectivity       — structural proxy (Fsp3, PAINS, aromatic density)
  bbb_penetration   — Egan/CNS-MPO heuristic for CNS drugs
  metabolic_stability — CYP/hydrolysis structural heuristics
  oral_absorption   — Lipinski + Veber bioavailability proxy
  synthetic_accessibility — inverted SA score (1 = easy to make)

Then runs non-dominated sorting (NSGA-II style) to assign Pareto front ranks.
"""
from __future__ import annotations
from typing import Optional

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

from backend.models.molecule import Molecule, ParetoObjectives, ObjectiveWeights


# ── Individual objective predictors ────────────────────────────────────────── #

def predict_bbb_penetration(smiles: str) -> float:
    """
    Egan/CNS-MPO heuristic: MW < 450, LogP 1–3.5, TPSA < 90, HBD ≤ 3.
    Returns 0-1 (1 = high CNS permeability).
    """
    if not RDKIT_AVAILABLE:
        return 0.5
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return 0.0

    mw   = Descriptors.ExactMolWt(mol)
    logp = Descriptors.MolLogP(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    hbd  = rdMolDescriptors.CalcNumHBD(mol)

    score  = 0.25 if mw < 450   else (0.10 if mw < 500    else 0.0)
    score += 0.25 if 1.0 <= logp <= 3.5 else (0.10 if logp > 0 else 0.0)
    score += 0.25 if tpsa < 90  else (0.10 if tpsa < 120  else 0.0)
    score += 0.25 if hbd <= 3   else 0.0
    return round(score, 2)


def predict_metabolic_stability(smiles: str) -> float:
    """
    CYP oxidation / hydrolysis heuristics.
    Returns 0-1 (1 = most metabolically stable).
    """
    if not RDKIT_AVAILABLE:
        return 0.5
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return 0.0

    score = 1.0
    logp  = Descriptors.MolLogP(mol)

    if logp > 4:
        score -= 0.20
    elif logp > 3:
        score -= 0.10

    if rdMolDescriptors.CalcNumAromaticRings(mol) >= 3:
        score -= 0.15

    aldehyde = Chem.MolFromSmarts("[CX2H1](=O)")
    if aldehyde and mol.HasSubstructMatch(aldehyde):
        score -= 0.20

    michael = Chem.MolFromSmarts("[CX3]=[CX3][C,c,S,s](=O)")
    if michael and mol.HasSubstructMatch(michael):
        score -= 0.15

    ar_amine = Chem.MolFromSmarts("[NH2][c]")
    if ar_amine and mol.HasSubstructMatch(ar_amine):
        score -= 0.15

    ester = Chem.MolFromSmarts("[CX3](=O)[OX2][CX4]")
    if ester and mol.HasSubstructMatch(ester):
        score -= 0.10

    # Fluorine blocks CYP oxidation sites
    f_pat = Chem.MolFromSmarts("[F]")
    if f_pat and mol.HasSubstructMatch(f_pat):
        score = min(1.0, score + 0.10)

    return round(max(0.0, min(1.0, score)), 2)


def predict_selectivity(smiles: str, admet=None) -> float:
    """
    Structural selectivity proxy.
    Returns 0-1 (1 = most selective / least promiscuous).
    """
    if not RDKIT_AVAILABLE:
        return 0.5
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return 0.0

    score = 0.60

    if admet and admet.has_pains:
        score -= 0.30
    if admet and admet.has_alerts:
        score -= 0.20

    heavy = mol.GetNumHeavyAtoms()
    ar    = rdMolDescriptors.CalcNumAromaticRings(mol)
    if heavy > 0 and ar / heavy > 0.30:
        score -= 0.10

    try:
        fsp3 = rdMolDescriptors.CalcFractionCSP3(mol)
        score += 0.15 if fsp3 > 0.40 else (0.05 if fsp3 > 0.25 else 0.0)
    except Exception:
        pass

    if Descriptors.ExactMolWt(mol) > 350:
        score += 0.10

    return round(max(0.0, min(1.0, score)), 2)


def predict_oral_absorption(admet=None) -> float:
    """
    Lipinski + Veber oral bioavailability proxy.
    Returns 0-1.
    """
    if admet is None:
        return 0.5
    score = 1.0
    if not admet.lipinski_pass:
        score -= 0.40
    if admet.tpsa is not None:
        score -= 0.30 if admet.tpsa > 140 else (0.10 if admet.tpsa > 90 else 0.0)
    if admet.rotatable_bonds is not None and admet.rotatable_bonds > 10:
        score -= 0.20
    if admet.mw is not None and admet.mw > 500:
        score -= 0.20
    return round(max(0.0, min(1.0, score)), 2)


def normalize_affinity(affinity_kcal: float) -> float:
    """Map kcal/mol → 0-1 linearly (-12 → 1.0, -4 → 0.0)."""
    clamped = max(-12.0, min(-4.0, affinity_kcal))
    return round((clamped - (-4.0)) / 8.0, 2)


# ── Main objective computation ──────────────────────────────────────────────── #

def compute_pareto_objectives(
    molecule: Molecule,
    docking_affinity: Optional[float],
) -> ParetoObjectives:
    admet = molecule.admet
    sa    = admet.synthetic_accessibility or 5.0
    sa_norm = round(max(0.0, min(1.0, 1.0 - (sa - 1.0) / 9.0)), 2)

    return ParetoObjectives(
        binding_affinity      = normalize_affinity(docking_affinity) if docking_affinity is not None else 0.5,
        selectivity           = predict_selectivity(molecule.smiles, admet),
        bbb_penetration       = predict_bbb_penetration(molecule.smiles),
        metabolic_stability   = predict_metabolic_stability(molecule.smiles),
        oral_absorption       = predict_oral_absorption(admet),
        synthetic_accessibility = sa_norm,
    )


# ── Pareto non-dominated sorting ────────────────────────────────────────────── #

def _dominates(a: list[float], b: list[float]) -> bool:
    """True if solution a Pareto-dominates b."""
    at_least_one_better = False
    for ai, bi in zip(a, b):
        if ai < bi:
            return False
        if ai > bi:
            at_least_one_better = True
    return at_least_one_better


def assign_pareto_ranks(scores: list[list[float]]) -> list[int]:
    """
    NSGA-II non-dominated sorting.
    Returns integer ranks per solution (1 = Pareto front, 2 = second front, …).
    """
    n = len(scores)
    if n == 0:
        return []

    domination_count = [0] * n
    dominated_set    = [[] for _ in range(n)]
    ranks            = [0] * n
    current_front: list[int] = []

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if _dominates(scores[i], scores[j]):
                dominated_set[i].append(j)
            elif _dominates(scores[j], scores[i]):
                domination_count[i] += 1
        if domination_count[i] == 0:
            ranks[i] = 1
            current_front.append(i)

    front_num = 1
    while current_front:
        next_front: list[int] = []
        for i in current_front:
            for j in dominated_set[i]:
                domination_count[j] -= 1
                if domination_count[j] == 0:
                    ranks[j] = front_num + 1
                    next_front.append(j)
        front_num += 1
        current_front = next_front

    return ranks


# ── Weighted scoring ────────────────────────────────────────────────────────── #

def compute_weighted_score(obj: ParetoObjectives, weights: ObjectiveWeights) -> float:
    return round(
        obj.binding_affinity       * weights.binding_affinity
        + obj.selectivity          * weights.selectivity
        + obj.bbb_penetration      * weights.bbb_penetration
        + obj.metabolic_stability  * weights.metabolic_stability
        + obj.oral_absorption      * weights.oral_absorption
        + obj.synthetic_accessibility * weights.synthetic_accessibility,
        3,
    )
