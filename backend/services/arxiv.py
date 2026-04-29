"""
arXiv API client — searches preprints relevant to drug targets and candidate molecules.
Uses the arXiv Atom API (no API key required).
"""
import xml.etree.ElementTree as ET
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.cache import DiskCache
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Atom namespace used in arXiv XML responses
_ATOM_NS = "http://www.w3.org/2005/Atom"
_ARXIV_NS = "http://arxiv.org/schemas/atom"

arxiv_cache = DiskCache("arxiv", ttl_hours=24)


class ArXivClient:
    """Async client for the arXiv public API."""

    def __init__(self):
        self.base_url = settings.arxiv_base_url

    async def search(
        self,
        query: str,
        max_results: Optional[int] = None,
    ) -> list[dict]:
        """
        Search arXiv for papers matching a free-text query.

        Returns a list of dicts with keys:
            arxiv_id, title, authors, summary, published, url, categories
        """
        max_results = max_results or settings.arxiv_max_results
        cache_key = f"search:{query}:{max_results}"
        cached = await arxiv_cache.aget(cache_key)
        if cached is not None:
            return cached

        params = {
            "search_query": query,
            "start": 0,
            "max_results": max_results,
            "sortBy": "relevance",
            "sortOrder": "descending",
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(self.base_url, params=params)
                r.raise_for_status()
                papers = self._parse_atom(r.text)
        except Exception as e:
            logger.warning(f"arXiv search failed for '{query}': {e}")
            return []

        await arxiv_cache.aset(cache_key, papers)
        return papers

    async def search_for_target(
        self,
        gene_symbol: str,
        disease_name: str,
    ) -> list[dict]:
        """
        Search for papers about a specific gene/protein as a drug target
        in the context of a disease.
        """
        query = (
            f'ti:"{gene_symbol}" OR abs:"{gene_symbol}" '
            f'AND (ti:"{disease_name}" OR abs:"drug" OR abs:"inhibitor" OR abs:"therapeutic")'
        )
        return await self.search(query)

    async def search_for_disease(self, disease_name: str) -> list[dict]:
        """
        Search for general drug discovery papers for a disease.
        """
        query = f'all:"{disease_name}" AND (ti:"drug discovery" OR ti:"therapeutic" OR ti:"inhibitor" OR ti:"clinical")'
        return await self.search(query)

    # ------------------------------------------------------------------ #
    #  Parsing                                                            #
    # ------------------------------------------------------------------ #

    def _parse_atom(self, xml_text: str) -> list[dict]:
        """Parse arXiv Atom XML into a list of paper dicts."""
        papers = []
        try:
            root = ET.fromstring(xml_text)
            entries = root.findall(f"{{{_ATOM_NS}}}entry")
            for entry in entries:
                arxiv_id = self._text(entry, f"{{{_ATOM_NS}}}id") or ""
                # Strip the full URL prefix to get just the ID
                arxiv_id = arxiv_id.replace("http://arxiv.org/abs/", "").strip()

                title = self._text(entry, f"{{{_ATOM_NS}}}title") or ""
                title = " ".join(title.split())  # normalise whitespace

                summary = self._text(entry, f"{{{_ATOM_NS}}}summary") or ""
                summary = " ".join(summary.split())

                published = self._text(entry, f"{{{_ATOM_NS}}}published") or ""
                published = published[:10]  # keep only YYYY-MM-DD

                authors = [
                    self._text(a, f"{{{_ATOM_NS}}}name") or ""
                    for a in entry.findall(f"{{{_ATOM_NS}}}author")
                ]

                # Use the HTML abs link as the paper URL
                url = ""
                for link in entry.findall(f"{{{_ATOM_NS}}}link"):
                    if link.get("type") == "text/html":
                        url = link.get("href", "")
                if not url and arxiv_id:
                    url = f"https://arxiv.org/abs/{arxiv_id}"

                # Categories
                categories = [
                    c.get("term", "")
                    for c in entry.findall(f"{{{_ATOM_NS}}}category")
                ]

                if title:
                    papers.append(
                        {
                            "arxiv_id": arxiv_id,
                            "title": title,
                            "authors": authors[:5],  # cap at 5
                            "summary": summary[:600],
                            "published": published,
                            "url": url,
                            "categories": categories,
                        }
                    )
        except ET.ParseError as e:
            logger.warning(f"arXiv XML parse error: {e}")
        return papers

    @staticmethod
    def _text(element: ET.Element, tag: str) -> Optional[str]:
        child = element.find(tag)
        return child.text if child is not None else None


arxiv_client = ArXivClient()
