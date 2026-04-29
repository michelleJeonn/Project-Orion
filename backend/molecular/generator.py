"""
Molecular Generation Engine.

Strategies (applied in sequence):
1. Known scaffold decoration   — decorate scaffolds from ChEMBL/known drugs
2. Fragment linking             — link common fragments targeting the protein class
3. Bioisostere replacement     — swap functional groups in known actives
4. Claude-guided SMILES design — LLM proposes novel SMILES given binding context

All candidates are filtered through ADMET checks before return.
"""
import asyncio
import random
import hashlib
from typing import Optional

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, rdMolDescriptors
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

from backend.models.molecule import Molecule, MoleculeLibrary
from backend.models.disease import Target
from backend.molecular.filters import (
    compute_admet,
    passes_drug_likeness,
    cluster_by_diversity,
    compute_tanimoto,
)
from backend.services.chembl import chembl_client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Curated fragment / scaffold libraries ────────────────────────────────── #

# Drug-like scaffolds by target class
TARGET_CLASS_SCAFFOLDS: dict[str, list[str]] = {
    "kinase": [
        "c1ccc2[nH]cnc2c1",               # purine-like
        "c1cnc2ccccc2n1",                   # quinazoline
        "c1ccc2ncccc2c1",                   # quinoline
        "O=C1NCCc2ccccc21",                 # oxindole
        "c1ccc(-c2ccncc2)cc1",              # pyridyl-phenyl
    ],
    "protease": [
        "O=C(N)CCC(=O)O",                   # glutamine-like
        "CC(C)CC(N)C(=O)O",                 # leucine mimic
        "O=C(N[C@@H]1CCCCC1)c1ccc(F)cc1",  # phenylalanine mimic
        "O=C1CCCN1",                         # pyrrolidinone
        "O=C(O)c1ccncc1",                   # nicotinic acid
    ],
    "gpcr": [
        "C1CCNCC1",                          # piperidine
        "C1CCNC1",                           # pyrrolidine
        "C1CN(Cc2ccccc2)CCN1",              # homopiperazine
        "c1ccc(OCC2CCNCC2)cc1",             # aryl-piperidine
        "O=C1CCCN1c1ccccc1",               # N-aryl-pyrrolidinone
    ],
    "nuclear_receptor": [
        "OC1=CC=C(C=C1)C1=CC=CO1",         # stilbene-like
        "c1ccc(C(=O)O)cc1",                 # benzoic acid
        "OC(=O)c1cccc(C(F)(F)F)c1",        # trifluoromethylbenzoic acid
        "c1cnc(N)nc1",                       # aminopyrimidine
    ],
    "default": [
        "c1ccccc1",                          # benzene
        "C1CCCCC1",                          # cyclohexane
        "c1ccncc1",                          # pyridine
        "c1ccoc1",                           # furan
        "c1ccsc1",                           # thiophene
        "C1CCNCC1",                          # piperidine
        "c1ccc2[nH]ccn2c1",                # indazole
        "O=C1CCN(c2ccccc2)CC1",            # N-aryl-piperidinone
    ],
}

SUBSTITUENTS = [
    "F", "Cl", "Br", "C", "N", "O", "S",
    "C(F)(F)F", "OC", "NC", "CC", "C(=O)N",
    "C(=O)O", "OCC", "NCC", "SC", "c1ccccc1",
]


class MolecularGenerationAgent:
    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    async def generate_candidates(
        self,
        target: Target,
        n_molecules: int = 100,
        progress_callback=None,
    ) -> MoleculeLibrary:
        """
        Generate a diverse library of drug-like candidates for a given target.
        """
        self.logger.info(
            f"Generating molecules for {target.gene_symbol} (n={n_molecules})"
        )

        library = MoleculeLibrary(
            target_uniprot_id=target.uniprot_id,
            generation_params={
                "n_requested": n_molecules,
                "target": target.gene_symbol,
            },
        )

        # 1. Fetch known actives from ChEMBL as seed scaffolds
        if progress_callback:
            await progress_callback("Fetching known active compounds...", 52)
        known_smiles = await self._get_known_actives(target)
        self.logger.info(f"Seeding with {len(known_smiles)} known actives")

        all_candidates: list[str] = []

        # 2. Scaffold decoration of known actives
        if known_smiles:
            decorated = self._decorate_scaffolds(known_smiles, n=n_molecules // 3)
            all_candidates.extend(decorated)
            self.logger.info(f"Scaffold decoration produced {len(decorated)} candidates")

        # 3. Fragment-based generation
        if progress_callback:
            await progress_callback("Running fragment-based generation...", 58)
        target_class = self._classify_target(target)
        fragment_mols = self._fragment_based_generation(
            target_class, n=n_molecules // 3
        )
        all_candidates.extend(fragment_mols)
        self.logger.info(f"Fragment linking produced {len(fragment_mols)} candidates")

        # 4. Bioisostere replacement on known actives
        if known_smiles:
            bioisosteres = self._bioisostere_swap(known_smiles[:5], n=n_molecules // 4)
            all_candidates.extend(bioisosteres)

        # 5. Deduplicate
        all_candidates = list(dict.fromkeys(s for s in all_candidates if s))

        # 6. Filter through ADMET
        if progress_callback:
            await progress_callback("Applying ADMET filters...", 64)
        molecules = self._apply_admet_filters(all_candidates, target)
        library.total_generated = len(all_candidates)
        library.total_passed_filters = len(molecules)
        self.logger.info(
            f"ADMET: {len(all_candidates)} -> {len(molecules)} passed"
        )

        # 7. Diversity selection
        if progress_callback:
            await progress_callback("Applying diversity selection...", 68)
        molecules = self._diversity_select(molecules, max_count=n_molecules)

        # Assign ranks and IDs
        for i, mol in enumerate(molecules):
            mol.rank = i + 1
            mol.molecule_id = f"{target.gene_symbol}_{i+1:04d}"

        library.molecules = molecules
        self.logger.info(f"Final library: {len(library.molecules)} molecules")
        return library

    # ------------------------------------------------------------------ #

    async def _get_known_actives(self, target: Target) -> list[str]:
        """Fetch SMILES of known active compounds from ChEMBL."""
        try:
            chembl_target = await chembl_client.get_target_by_uniprot(target.uniprot_id)
            if not chembl_target:
                return []
            chembl_id = chembl_target.get("target_chembl_id", "")
            drugs = await chembl_client.get_approved_drugs_for_target(chembl_id, max_phase=2)
            smiles = [d["smiles"] for d in drugs if d.get("smiles")]
            return smiles[:10]
        except Exception as e:
            self.logger.warning(f"ChEMBL lookup failed: {e}")
            return []

    def _classify_target(self, target: Target) -> str:
        """Roughly classify target protein type for scaffold selection."""
        name_lower = (target.protein_name + target.function_summary).lower()
        if any(k in name_lower for k in ["kinase", "phospho"]):
            return "kinase"
        if any(k in name_lower for k in ["protease", "peptidase", "cleave"]):
            return "protease"
        if any(k in name_lower for k in ["receptor", "gpcr", "agonist", "adrenergic"]):
            return "gpcr"
        if any(k in name_lower for k in ["nuclear", "steroid", "hormone"]):
            return "nuclear_receptor"
        return "default"

    def _fragment_based_generation(
        self, target_class: str, n: int = 30
    ) -> list[str]:
        """Generate molecules by combining class-appropriate scaffolds with substituents."""
        if not RDKIT_AVAILABLE:
            return []

        scaffolds = TARGET_CLASS_SCAFFOLDS.get(target_class, TARGET_CLASS_SCAFFOLDS["default"])
        molecules = []
        attempts = 0
        rng = random.Random(42)

        while len(molecules) < n and attempts < n * 10:
            attempts += 1
            scaffold_smi = rng.choice(scaffolds)
            mol = Chem.MolFromSmiles(scaffold_smi)
            if mol is None:
                continue

            # Add 1-3 random substituents via simple string concat (heuristic)
            n_subs = rng.randint(1, 3)
            candidate = scaffold_smi
            for _ in range(n_subs):
                sub = rng.choice(SUBSTITUENTS)
                candidate = self._simple_substitute(candidate, sub, rng)

            if Chem.MolFromSmiles(candidate):
                molecules.append(candidate)

        return molecules

    def _simple_substitute(self, smiles: str, substituent: str, rng: random.Random) -> str:
        """Heuristic: attach substituent at a random aromatic position."""
        if not RDKIT_AVAILABLE:
            return smiles
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return smiles

        # Find aromatic CH atoms that can be substituted
        aromatic_ch = [
            atom.GetIdx()
            for atom in mol.GetAtoms()
            if atom.GetIsAromatic()
            and atom.GetTotalNumHs() > 0
            and atom.GetSymbol() == "C"
        ]
        if not aromatic_ch:
            return smiles

        # Build new SMILES with substituent on chosen atom
        try:
            from rdkit.Chem import RWMol, AllChem
            rw = RWMol(mol)
            pos = rng.choice(aromatic_ch)
            sub_mol = Chem.MolFromSmiles(substituent)
            if sub_mol is None:
                return smiles
            combo = Chem.CombineMols(rw, sub_mol)
            edit = RWMol(combo)
            sub_atom_idx = mol.GetNumAtoms()
            edit.AddBond(pos, sub_atom_idx, Chem.BondType.SINGLE)
            Chem.SanitizeMol(edit)
            return Chem.MolToSmiles(edit)
        except Exception:
            return smiles

    def _decorate_scaffolds(self, seed_smiles: list[str], n: int = 30) -> list[str]:
        """
        Generate analogs by making bioisosteric replacements on seed molecules.
        """
        if not RDKIT_AVAILABLE or not seed_smiles:
            return []

        decorated: list[str] = []
        rng = random.Random(123)

        for seed in seed_smiles:
            mol = Chem.MolFromSmiles(seed)
            if mol is None:
                continue
            for _ in range(max(1, n // len(seed_smiles))):
                sub = rng.choice(SUBSTITUENTS)
                variant = self._simple_substitute(seed, sub, rng)
                if variant != seed and Chem.MolFromSmiles(variant):
                    decorated.append(variant)

        return decorated[:n]

    def _bioisostere_swap(self, seed_smiles: list[str], n: int = 20) -> list[str]:
        """Replace common functional groups with bioisosteres."""
        SWAPS = [
            ("C(=O)O", "C(=O)N"),      # acid -> amide
            ("c1ccccc1", "c1ccncc1"),   # benzene -> pyridine
            ("c1ccccc1", "c1ccsc1"),    # benzene -> thiophene
            ("OC", "NC"),               # methoxy -> methylamino
            ("F", "Cl"),
            ("Cl", "F"),
            ("C(F)(F)F", "C(Cl)(Cl)Cl"),
        ]
        if not RDKIT_AVAILABLE:
            return []

        results: list[str] = []
        rng = random.Random(77)
        for seed in seed_smiles:
            for old, new in rng.sample(SWAPS, min(len(SWAPS), 4)):
                variant = seed.replace(old, new, 1)
                if variant != seed and Chem.MolFromSmiles(variant):
                    results.append(variant)
            if len(results) >= n:
                break
        return results[:n]

    def _apply_admet_filters(
        self, smiles_list: list[str], target: Target
    ) -> list[Molecule]:
        """Filter SMILES by ADMET, return Molecule objects."""
        molecules: list[Molecule] = []
        for smi in smiles_list:
            if not smi:
                continue
            admet = compute_admet(smi)
            if admet is None:
                continue
            if not passes_drug_likeness(admet):
                continue
            inchi_key = None
            if RDKIT_AVAILABLE:
                mol = Chem.MolFromSmiles(smi)
                if mol:
                    from rdkit.Chem.inchi import MolToInchiKey
                    try:
                        inchi_key = MolToInchiKey(mol)
                    except Exception:
                        pass
                    smi = Chem.MolToSmiles(mol)  # canonical SMILES

            molecules.append(
                Molecule(
                    smiles=smi,
                    inchi_key=inchi_key,
                    admet=admet,
                    generation_method="fragment_linking+scaffold_decoration",
                )
            )
        return molecules

    def _diversity_select(
        self, molecules: list[Molecule], max_count: int = 100
    ) -> list[Molecule]:
        """Select diverse subset using Tanimoto clustering."""
        if len(molecules) <= max_count:
            return molecules

        smiles_list = [m.smiles for m in molecules]
        clusters = cluster_by_diversity(smiles_list, max_clusters=max_count)

        selected_indices: list[int] = []
        # Take the highest QED molecule from each cluster
        for cluster_indices in clusters.values():
            best_idx = max(
                cluster_indices,
                key=lambda i: molecules[i].admet.qed_score or 0,
            )
            selected_indices.append(best_idx)
            molecules[best_idx].diversity_cluster = list(clusters.keys()).index(
                list(clusters.keys())[list(clusters.values()).index(cluster_indices)]
            )
            if len(selected_indices) >= max_count:
                break

        # Sort by QED score
        selected = [molecules[i] for i in selected_indices]
        selected.sort(key=lambda m: m.admet.qed_score or 0, reverse=True)
        return selected[:max_count]
