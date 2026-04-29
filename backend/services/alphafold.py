"""EBI AlphaFold API client — fetches predicted protein structures when no experimental PDB exists."""
from pathlib import Path
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.cache import protein_cache
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class AlphaFoldClient:
    def __init__(self):
        self.base = settings.alphafold_base_url
        self.structures_dir = settings.structures_dir

    async def get_structure(self, uniprot_id: str) -> Optional[str]:
        """
        Download AlphaFold predicted structure for a UniProt accession.
        Returns local path on success, None if unavailable.
        """
        local_path = self.structures_dir / f"AF-{uniprot_id}.pdb"
        if local_path.exists():
            return str(local_path)

        pdb_url = await self._get_pdb_url(uniprot_id)
        if not pdb_url:
            return None

        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                r = await client.get(pdb_url)
                r.raise_for_status()
                local_path.write_bytes(r.content)
            logger.info(f"AlphaFold structure for {uniprot_id} -> {local_path}")
            return str(local_path)
        except Exception as e:
            logger.warning(f"AlphaFold download failed for {uniprot_id}: {e}")
            return None

    async def _get_pdb_url(self, uniprot_id: str) -> Optional[str]:
        cache_key = f"af_url:{uniprot_id}"
        cached = await protein_cache.aget(cache_key)
        if cached:
            return cached

        # Try EBI API first to get the canonical URL
        url = await self._try_ebi_api(uniprot_id)

        # Fall back to well-known CDN pattern if API lookup failed
        if not url:
            url = f"https://alphafold.ebi.ac.uk/files/AF-{uniprot_id}-F1-model_v4.pdb"
            logger.info(f"AlphaFold API lookup failed for {uniprot_id}, trying CDN fallback: {url}")

        if url:
            await protein_cache.aset(cache_key, url)
        return url

    async def _try_ebi_api(self, uniprot_id: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(f"{self.base}/prediction/{uniprot_id}")
                if r.status_code == 404:
                    return None
                r.raise_for_status()
                data = r.json()
                if not data:
                    return None
                # Try both field names used across API versions
                return data[0].get("pdbUrl") or data[0].get("cifUrl") or None
        except Exception as e:
            logger.warning(f"AlphaFold API error for {uniprot_id}: {e}")
            return None

    def is_alphafold_structure(self, path: str) -> bool:
        return Path(path).name.startswith("AF-")


alphafold_client = AlphaFoldClient()
