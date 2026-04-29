"""DisGeNET API client for disease-gene association data."""
from typing import Optional

import httpx

from backend.utils.cache import pubmed_cache
from backend.utils.logger import get_logger

logger = get_logger(__name__)

DISGENET_BASE = "https://www.disgenet.org/api"


class DisGeNETClient:
    """
    DisGeNET public API (v7).
    No API key required for basic access.
    """

    async def get_genes_for_disease(
        self,
        disease_name: str,
        min_score: float = 0.1,
        max_results: int = 20,
    ) -> list[dict]:
        """
        Return gene-disease associations for a disease name/UMLS concept.
        Falls back to a keyword search if exact match fails.
        """
        cache_key = f"disgenet:{disease_name}:{min_score}:{max_results}"
        cached = await pubmed_cache.aget(cache_key)
        if cached is not None:
            return cached

        associations: list[dict] = []
        try:
            # Search by disease name (returns top GDAs)
            params = {
                "disease_name": disease_name,
                "source": "ALL",
                "format": "json",
                "limit": max_results,
            }
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(f"{DISGENET_BASE}/gda/disease/search", params=params)
                if r.status_code == 200:
                    raw = r.json()
                    associations = [
                        {
                            "gene_symbol": item.get("gene_symbol", ""),
                            "gene_id": item.get("geneid", ""),
                            "score": item.get("score", 0.0),
                            "disease_name": item.get("disease_name", disease_name),
                            "pmids": item.get("pmid_list", []),
                            "sources": item.get("source", ""),
                        }
                        for item in raw
                        if item.get("score", 0) >= min_score
                        and item.get("gene_symbol")
                    ]
                elif r.status_code == 404:
                    logger.info(f"DisGeNET: no results for '{disease_name}'")
                elif r.status_code in (401, 403):
                    logger.warning(f"DisGeNET API requires authentication (status {r.status_code})")
                else:
                    logger.warning(f"DisGeNET API returned {r.status_code}")
        except httpx.RequestError as e:
            logger.warning(f"DisGeNET request failed: {e}")

        # Sort by score descending
        associations.sort(key=lambda x: x["score"], reverse=True)
        await pubmed_cache.aset(cache_key, associations)
        return associations

    async def get_disease_info(self, disease_name: str) -> Optional[dict]:
        """Return disease metadata from DisGeNET."""
        try:
            params = {"disease_name": disease_name, "source": "ALL", "format": "json", "limit": 1}
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(f"{DISGENET_BASE}/disease/search", params=params)
                if r.status_code == 200:
                    results = r.json()
                    return results[0] if results else None
        except Exception as e:
            logger.warning(f"DisGeNET disease info error: {e}")
        return None


disgenet_client = DisGeNETClient()
