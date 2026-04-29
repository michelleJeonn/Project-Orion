"""
DiffDock ML-based molecular docking integration.

Install DiffDock to enable:
  pip install diffdock
  # or: git clone https://github.com/gcorso/DiffDock && pip install -e DiffDock/

Falls back gracefully to AutoDock Vina when unavailable.
"""
import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Optional

from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Detect availability at import time
DIFFDOCK_AVAILABLE = False
try:
    import diffdock  # noqa: F401
    DIFFDOCK_AVAILABLE = True
    logger.info("DiffDock detected — ML docking enabled")
except ImportError:
    logger.info("DiffDock not installed — using AutoDock Vina for docking")


class DiffDockClient:
    """
    Runs DiffDock inference for protein-ligand docking.
    Outputs are SDF files ranked by confidence score.
    """

    def is_available(self) -> bool:
        return DIFFDOCK_AVAILABLE

    async def dock(
        self,
        protein_pdb_path: str,
        ligand_sdf_path: str,
        out_dir: str,
        samples: int = 10,
    ) -> list[dict]:
        """
        Run DiffDock for one protein-ligand pair.
        Returns list of {pose_path: str, confidence: float} sorted by confidence desc.
        Returns [] if DiffDock is unavailable or fails.
        """
        if not DIFFDOCK_AVAILABLE:
            return []

        Path(out_dir).mkdir(parents=True, exist_ok=True)
        try:
            poses = await asyncio.to_thread(
                self._run_subprocess, protein_pdb_path, ligand_sdf_path, out_dir, samples
            )
            logger.info(f"DiffDock produced {len(poses)} poses in {out_dir}")
            return poses
        except Exception as e:
            logger.warning(f"DiffDock inference failed: {e}")
            return []

    def _run_subprocess(
        self,
        protein_path: str,
        ligand_path: str,
        out_dir: str,
        samples: int,
    ) -> list[dict]:
        cmd = [
            sys.executable, "-m", "diffdock",
            "--protein_path", protein_path,
            "--ligand", ligand_path,
            "--out_dir", out_dir,
            "--samples_per_complex", str(samples),
            "--no_final_step_noise",
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            raise RuntimeError(f"DiffDock exited {result.returncode}: {result.stderr[:400]}")
        return self._parse_outputs(out_dir)

    def _parse_outputs(self, out_dir: str) -> list[dict]:
        """
        Parse DiffDock output directory.
        Files are named: rank{N}_confidence{score}.sdf
        """
        poses = []
        for sdf_file in Path(out_dir).glob("rank*_confidence*.sdf"):
            name = sdf_file.stem
            try:
                confidence = float(name.split("confidence")[1])
            except (IndexError, ValueError):
                confidence = 0.0
            poses.append({"pose_path": str(sdf_file), "confidence": confidence})
        poses.sort(key=lambda x: x["confidence"], reverse=True)
        return poses

    async def smiles_to_sdf(self, smiles: str, out_path: str) -> bool:
        """Convert SMILES to 3D SDF for use as DiffDock ligand input."""
        try:
            from rdkit import Chem
            from rdkit.Chem import AllChem

            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return False
            mol = Chem.AddHs(mol)
            params = AllChem.ETKDGv3()
            params.randomSeed = 42
            if AllChem.EmbedMolecule(mol, params) == -1:
                return False
            AllChem.MMFFOptimizeMolecule(mol, maxIters=200)
            writer = Chem.SDWriter(out_path)
            writer.write(mol)
            writer.close()
            return True
        except Exception as e:
            logger.warning(f"SMILES→SDF conversion failed: {e}")
            return False


diffdock_client = DiffDockClient()
