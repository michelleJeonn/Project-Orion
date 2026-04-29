"""ChEMBL REST API client for known bioactivity data."""
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.cache import chembl_cache
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class ChEMBLClient:
    def __init__(self):
        self.base = settings.chembl_base_url

    async def get_target_by_uniprot(self, uniprot_id: str) -> Optional[dict]:
        """Find ChEMBL target ID from UniProt accession."""
        cache_key = f"chembl_target:{uniprot_id}"
        cached = await chembl_cache.aget(cache_key)
        if cached is not None:
            return cached

        params = {
            "target_components__accession": uniprot_id,
            "format": "json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base}/target.json", params=params)
            r.raise_for_status()
            results = r.json().get("targets", [])

        data = results[0] if results else None
        await chembl_cache.aset(cache_key, data)
        return data

    async def get_approved_drugs_for_target(
        self, chembl_target_id: str, max_phase: int = 4
    ) -> list[dict]:
        """
        Return approved/clinical drugs for a ChEMBL target.
        max_phase=4 means approved drugs only.
        """
        cache_key = f"drugs:{chembl_target_id}:{max_phase}"
        cached = await chembl_cache.aget(cache_key)
        if cached is not None:
            return cached

        params = {
            "target_chembl_id": chembl_target_id,
            "molecule__max_phase__gte": max_phase,
            "format": "json",
            "limit": 25,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base}/activity.json", params=params)
            r.raise_for_status()
            activities = r.json().get("activities", [])

        drugs = []
        seen = set()
        for act in activities:
            mol_id = act.get("molecule_chembl_id", "")
            if mol_id and mol_id not in seen:
                seen.add(mol_id)
                drugs.append({
                    "molecule_chembl_id": mol_id,
                    "molecule_name": act.get("molecule_pref_name", ""),
                    "standard_type": act.get("standard_type", ""),
                    "standard_value": act.get("standard_value"),
                    "standard_units": act.get("standard_units", ""),
                    "smiles": act.get("canonical_smiles", ""),
                })

        await chembl_cache.aset(cache_key, drugs)
        return drugs

    async def get_similar_compounds(
        self, smiles: str, similarity: int = 70
    ) -> list[dict]:
        """Find ChEMBL compounds similar to a SMILES string."""
        cache_key = f"similar:{smiles[:50]}:{similarity}"
        cached = await chembl_cache.aget(cache_key)
        if cached is not None:
            return cached

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{self.base}/similarity/{smiles}/{similarity}.json",
                params={"limit": 10},
            )
            if r.status_code in (400, 404):
                return []
            r.raise_for_status()
            results = r.json().get("molecules", [])

        await chembl_cache.aset(cache_key, results)
        return results


chembl_client = ChEMBLClient()
