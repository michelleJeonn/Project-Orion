"""PubMed E-utilities client for disease-gene literature mining."""
import asyncio
import xml.etree.ElementTree as ET
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.cache import pubmed_cache
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class PubMedClient:
    def __init__(self):
        self.base = settings.pubmed_base_url
        self.email = settings.ncbi_email
        self.api_key = settings.pubmed_api_key

    def _params(self, extra: dict) -> dict:
        p = {"email": self.email, "tool": "genesis_drug_discovery", **extra}
        if self.api_key:
            p["api_key"] = self.api_key
        return p

    async def search(self, query: str, max_results: int = 50) -> list[str]:
        """Return list of PMIDs for a query."""
        cache_key = f"search:{query}:{max_results}"
        cached = await pubmed_cache.aget(cache_key)
        if cached:
            return cached

        params = self._params({
            "db": "pubmed",
            "term": query,
            "retmax": max_results,
            "retmode": "json",
            "usehistory": "n",
        })
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base}/esearch.fcgi", params=params)
            r.raise_for_status()
            pmids: list[str] = r.json()["esearchresult"]["idlist"]

        await pubmed_cache.aset(cache_key, pmids)
        return pmids

    async def fetch_abstracts(self, pmids: list[str]) -> list[dict]:
        """Fetch title + abstract for a list of PMIDs."""
        if not pmids:
            return []
        cache_key = f"abstracts:{','.join(sorted(pmids[:20]))}"
        cached = await pubmed_cache.aget(cache_key)
        if cached:
            return cached

        params = self._params({
            "db": "pubmed",
            "id": ",".join(pmids[:20]),
            "retmode": "xml",
            "rettype": "abstract",
        })
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base}/efetch.fcgi", params=params)
            r.raise_for_status()
            xml_text = r.text

        articles = []
        try:
            root = ET.fromstring(xml_text)
            for article in root.findall(".//PubmedArticle"):
                pmid_el = article.find(".//PMID")
                title_el = article.find(".//ArticleTitle")
                abstract_texts = article.findall(".//AbstractText")
                pmid = pmid_el.text if pmid_el is not None else ""
                title = title_el.text or "" if title_el is not None else ""
                abstract = " ".join(
                    (el.text or "") for el in abstract_texts if el.text
                )
                articles.append({"pmid": pmid, "title": title, "abstract": abstract})
        except ET.ParseError as e:
            logger.warning(f"PubMed XML parse error: {e}")

        await pubmed_cache.aset(cache_key, articles)
        return articles

    async def get_disease_gene_associations(self, disease: str) -> list[str]:
        """Return gene symbols mentioned in PubMed for a disease."""
        pmids = await self.search(f"{disease}[MeSH] AND gene[Title/Abstract]", max_results=100)
        if not pmids:
            pmids = await self.search(f"{disease} therapeutic target", max_results=50)
        return pmids


pubmed_client = PubMedClient()
