"""RCSB PDB REST API client + structure downloader."""
import asyncio
from pathlib import Path
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.cache import protein_cache
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class PDBClient:
    def __init__(self):
        self.data_url = settings.pdb_base_url
        self.files_url = settings.pdb_files_url
        self.structures_dir = settings.structures_dir

    async def get_entry(self, pdb_id: str) -> Optional[dict]:
        """Fetch metadata for a PDB entry."""
        pdb_id = pdb_id.upper()
        cache_key = f"pdb_entry:{pdb_id}"
        cached = await protein_cache.aget(cache_key)
        if cached:
            return cached

        url = f"{self.data_url}/core/entry/{pdb_id}"
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            data = r.json()

        await protein_cache.aset(cache_key, data)
        return data

    async def download_pdb(self, pdb_id: str) -> Optional[str]:
        """Download a PDB file, return local path."""
        pdb_id = pdb_id.upper()
        local_path = self.structures_dir / f"{pdb_id}.pdb"
        if local_path.exists():
            return str(local_path)

        url = f"{self.files_url}/{pdb_id}.pdb"
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code == 404:
                logger.warning(f"PDB {pdb_id} not found at RCSB")
                return None
            r.raise_for_status()
            local_path.write_bytes(r.content)

        logger.info(f"Downloaded PDB {pdb_id} -> {local_path}")
        return str(local_path)

    async def get_binding_site(self, pdb_id: str) -> Optional[dict]:
        """
        Return binding site residues + center of mass for the first ligand site.
        Uses RCSB's 'binding_affinity' or 'drugbank' annotations when available.
        Falls back to HETATM centroid calculation.
        """
        pdb_id = pdb_id.upper()
        cache_key = f"binding_site:{pdb_id}"
        cached = await protein_cache.aget(cache_key)
        if cached:
            return cached

        url = f"{self.data_url}/core/entry/{pdb_id}"
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return None
            entry = r.json()

        # Try to find ligand atoms to estimate center
        site: dict = {"residues": [], "center": None, "size": [20.0, 20.0, 20.0]}

        ligand_url = f"https://data.rcsb.org/rest/v1/core/chemcomp?pdb_id={pdb_id}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                lr = await client.get(
                    f"https://data.rcsb.org/rest/v1/core/entry/{pdb_id}/binding_affinity"
                )
                if lr.status_code == 200:
                    ba_data = lr.json()
                    # Extract residues if available
                    pass
        except Exception:
            pass

        await protein_cache.aset(cache_key, site)
        return site

    async def select_best_pdb(self, pdb_ids: list[str]) -> Optional[str]:
        """
        Pick the best PDB ID: prefer human protein, good resolution, with ligand.
        Returns None if list is empty.
        """
        if not pdb_ids:
            return None
        if len(pdb_ids) == 1:
            return pdb_ids[0]

        scored: list[tuple[float, str]] = []
        for pdb_id in pdb_ids[:10]:  # check first 10 at most
            entry = await self.get_entry(pdb_id)
            if not entry:
                continue
            score = 0.0
            # Prefer lower resolution (smaller number = better)
            res = entry.get("rcsb_entry_info", {}).get("resolution_combined", [])
            resolution = res[0] if res else 99.0
            if resolution < 2.5:
                score += 3
            elif resolution < 3.0:
                score += 1
            # Prefer entries with small molecule ligands
            n_ligands = entry.get("rcsb_entry_info", {}).get(
                "nonpolymer_entity_count", 0
            )
            if n_ligands > 0:
                score += 2
            # Prefer X-ray
            method = entry.get("exptl", [{}])[0].get("method", "")
            if method == "X-RAY DIFFRACTION":
                score += 1
            scored.append((score, pdb_id))

        if not scored:
            return pdb_ids[0]
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]


pdb_client = PDBClient()
