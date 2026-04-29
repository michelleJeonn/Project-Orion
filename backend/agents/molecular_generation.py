"""
Molecular Generation Agent — wraps the generator engine and adds
Claude-guided SMILES design for additional scaffold diversity.
"""
import asyncio
from backend.agents.base_agent import BaseAgent
from backend.models.molecule import Molecule, MoleculeLibrary
from backend.models.disease import Target
from backend.molecular.generator import MolecularGenerationAgent as GeneratorEngine
from backend.molecular.filters import compute_admet, passes_drug_likeness
from backend.config import settings

try:
    from rdkit import Chem
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False


SYSTEM_MOLGEN = """You are an expert medicinal chemist with deep expertise in
structure-activity relationships and drug design. You generate valid SMILES
strings for small molecule drug candidates targeting specific proteins."""


class MolecularGenerationAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.engine = GeneratorEngine()

    async def generate_candidates(
        self,
        target: Target,
        n_molecules: int = None,
        progress_callback=None,
    ) -> MoleculeLibrary:
        """Generate a drug-like molecular library for the given target."""
        n = n_molecules or settings.max_molecules_per_target

        # Run RDKit-based generation
        library = await self.engine.generate_candidates(
            target=target,
            n_molecules=n,
            progress_callback=progress_callback,
        )

        # Supplement with Claude-designed SMILES if library is small (skip in demo mode)
        if not settings.demo_mode and len(library.molecules) < 20:
            if progress_callback:
                await progress_callback("Requesting AI-designed molecules...", 70)
            claude_mols = await self._claude_generate(target, n=25)
            library.molecules.extend(claude_mols)
            library.total_passed_filters += len(claude_mols)
            self.logger.info(f"Claude added {len(claude_mols)} molecules")

        # Re-rank by QED
        library.molecules.sort(
            key=lambda m: m.admet.qed_score or 0, reverse=True
        )
        for i, m in enumerate(library.molecules):
            m.rank = i + 1

        return library

    async def _claude_generate(self, target: Target, n: int = 20) -> list[Molecule]:
        """Ask Claude to generate novel SMILES for a target."""
        prompt = f"""Target protein: {target.protein_name} ({target.gene_symbol})
UniProt ID: {target.uniprot_id}
Function: {target.function_summary[:300]}

Design {n} novel, diverse small molecule drug candidates for this target.
Requirements:
- Valid SMILES (critically important)
- Molecular weight 200–500 Da
- LogP between -1 and 5
- ≤ 5 H-bond donors, ≤ 10 H-bond acceptors
- No reactive or toxic groups
- Structurally diverse (different scaffolds)
- Include both aromatic and aliphatic scaffolds
- Consider known binding modes for this protein class

Return ONLY a JSON array of SMILES strings, like:
["CCO...", "c1ccc..."]

Generate exactly {n} valid SMILES."""

        try:
            result = await self.ask_claude_json(
                system=SYSTEM_MOLGEN,
                prompt=prompt,
                max_tokens=2048,
            )
            if not isinstance(result, list):
                return []

            molecules = []
            for smi in result:
                if not isinstance(smi, str):
                    continue
                admet = compute_admet(smi)
                if admet and passes_drug_likeness(admet):
                    # Canonicalize
                    if RDKIT_AVAILABLE:
                        mol = Chem.MolFromSmiles(smi)
                        if mol:
                            smi = Chem.MolToSmiles(mol)
                        else:
                            continue
                    molecules.append(
                        Molecule(
                            smiles=smi,
                            admet=admet,
                            generation_method="claude_design",
                        )
                    )
            return molecules
        except Exception as e:
            self.logger.warning(f"Claude molecule generation failed: {e}")
            return []
