"""UniProt REST API client for protein annotation."""
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.cache import protein_cache
from backend.utils.logger import get_logger

logger = get_logger(__name__)

UNIPROT_FIELDS = (
    "accession,id,gene_names,protein_name,organism_name,"
    "cc_function,cc_pathway,go_p,go_f,length,mass,reviewed"
)


class UniProtClient:
    def __init__(self):
        self.base = settings.uniprot_base_url

    async def search_by_gene(
        self,
        gene_symbol: str,
        organism: str = "Homo sapiens",
        reviewed_only: bool = True,
    ) -> list[dict]:
        """Search UniProt for a gene in a given organism."""
        cache_key = f"gene:{gene_symbol}:{organism}:{reviewed_only}"
        cached = await protein_cache.aget(cache_key)
        if cached:
            return cached

        query = f'gene:{gene_symbol} AND taxonomy_id:9606'
        if reviewed_only:
            query += " AND reviewed:true"

        params = {
            "query": query,
            "fields": UNIPROT_FIELDS,
            "format": "json",
            "size": 5,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base}/uniprotkb/search", params=params)
            r.raise_for_status()
            results = r.json().get("results", [])

        await protein_cache.aset(cache_key, results)
        return results

    async def get_by_accession(self, accession: str) -> Optional[dict]:
        """Fetch a single UniProt entry by accession."""
        cache_key = f"accession:{accession}"
        cached = await protein_cache.aget(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{self.base}/uniprotkb/{accession}",
                params={"format": "json"},
            )
            if r.status_code == 404:
                return None
            r.raise_for_status()
            data = r.json()

        await protein_cache.aset(cache_key, data)
        return data

    def extract_pdb_ids(self, entry: dict) -> list[str]:
        """Pull PDB cross-references from a UniProt entry."""
        pdb_ids = []
        for xref in entry.get("uniProtKBCrossReferences", []):
            if xref.get("database") == "PDB":
                pdb_ids.append(xref["id"])
        return pdb_ids

    def extract_function(self, entry: dict) -> str:
        """Extract function description from UniProt entry."""
        for comment in entry.get("comments", []):
            if comment.get("commentType") == "FUNCTION":
                texts = comment.get("texts", [])
                if texts:
                    return texts[0].get("value", "")
        return ""

    def extract_pathways(self, entry: dict) -> list[dict]:
        """Extract pathway information from UniProt entry."""
        pathways = []
        for comment in entry.get("comments", []):
            if comment.get("commentType") == "PATHWAY":
                for text in comment.get("texts", []):
                    pathways.append({
                        "name": text.get("value", ""),
                        "database": "UniProt",
                    })
        return pathways


uniprot_client = UniProtClient()
