"""
KEGG + Reactome pathway graph service.
Given a gene symbol and optional UniProt ID, returns a structured node/edge graph.
"""
import asyncio
import re
import xml.etree.ElementTree as ET
from collections import deque
from typing import Optional

import httpx

from backend.utils.cache import DiskCache
from backend.utils.logger import get_logger

logger = get_logger(__name__)

pathway_cache = DiskCache("pathways", ttl_hours=168)  # 1 week

KEGG_BASE = "https://rest.kegg.jp"
REACTOME_BASE = "https://reactome.org/ContentService"


# ── KEGG helpers ─────────────────────────────────────────────────

async def _kegg_gene_id(gene_symbol: str, uniprot_id: str) -> Optional[str]:
    """
    Resolve a gene symbol to a KEGG human gene ID (e.g. "hsa:351").

    Tries UniProt → KEGG conversion first (most reliable), then falls back
    to a name search with exact symbol matching.
    """
    # 1. UniProt accession → KEGG ID (exact, no ambiguity)
    if uniprot_id:
        try:
            url = f"{KEGG_BASE}/conv/hsa/uniprot:{uniprot_id}"
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(url)
            if r.status_code == 200 and r.text.strip():
                parts = r.text.strip().split("\t")
                if len(parts) == 2:
                    return parts[1].strip()  # e.g. "hsa:351"
        except Exception as e:
            logger.debug(f"KEGG UniProt conv failed for {uniprot_id}: {e}")

    # 2. Gene symbol search — look for exact first-symbol match
    try:
        url = f"{KEGG_BASE}/find/hsa/{gene_symbol}"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url)
        if r.status_code == 200 and r.text.strip():
            upper = gene_symbol.upper()
            for line in r.text.strip().split("\n"):
                parts = line.split("\t")
                if len(parts) != 2:
                    continue
                kegg_id = parts[0].strip()           # e.g. "hsa:120892"
                desc = parts[1].strip()              # e.g. "LRRK2, DARDARIN; ..."
                # First comma-separated token before ";" is the primary symbol
                primary = desc.split(";")[0].split(",")[0].strip().upper()
                if primary == upper:
                    return kegg_id
    except Exception as e:
        logger.debug(f"KEGG find failed for {gene_symbol}: {e}")

    return None


async def _kegg_pathway_ids(gene_symbol: str, uniprot_id: str) -> list[str]:
    """Return KEGG human pathway IDs associated with a gene."""
    kegg_id = await _kegg_gene_id(gene_symbol, uniprot_id)
    if not kegg_id:
        return []
    try:
        url = f"{KEGG_BASE}/link/pathway/{kegg_id}"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url)
        if r.status_code != 200 or not r.text.strip():
            return []
        ids = []
        for line in r.text.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) == 2:
                ids.append(parts[1].strip())  # "path:hsa05010"
        return ids
    except Exception as e:
        logger.warning(f"KEGG pathway link failed for {kegg_id}: {e}")
        return []


async def _kegg_kgml(pathway_id: str) -> Optional[dict]:
    """Fetch KGML for a pathway and parse it into nodes + edges."""
    pid = pathway_id.replace("path:", "")
    url = f"{KEGG_BASE}/get/{pid}/kgml"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url)
        if r.status_code != 200:
            return None
        return _parse_kgml(r.text, pid)
    except Exception as e:
        logger.warning(f"KEGG KGML fetch failed for {pathway_id}: {e}")
        return None


def _parse_kgml(kgml_text: str, pathway_id: str) -> dict:
    """Parse KGML XML into {nodes, edges}."""
    try:
        root = ET.fromstring(kgml_text)
    except ET.ParseError as e:
        logger.warning(f"KGML parse error for {pathway_id}: {e}")
        return {"nodes": [], "edges": [], "pathway_id": pathway_id}

    entry_map: dict[str, dict] = {}

    for entry in root.findall("entry"):
        eid = entry.get("id", "")
        etype = entry.get("type", "gene")
        names_raw = entry.get("name", "")

        # Prefer the graphics label (more human-readable)
        label = ""
        graphics = entry.find("graphics")
        if graphics is not None:
            raw_label = graphics.get("name", "")
            label = re.sub(r"\s*\.\.\.$", "", raw_label.split(",")[0].strip())

        if not label:
            # Strip database prefix from first token: "hsa:596" → "596", but gene entries
            # have names like "hsa:596 hsa:597" — fall back to the gene id
            first = names_raw.split()[0] if names_raw else eid
            label = re.sub(r"^[a-z]+:", "", first)

        node_type = _classify_node(etype, label)
        entry_map[eid] = {"id": label, "type": node_type}

    # Deduplicate nodes by id
    seen_ids: set[str] = set()
    nodes = []
    for e in entry_map.values():
        if e["id"] and e["id"] not in seen_ids:
            seen_ids.add(e["id"])
            nodes.append({"id": e["id"], "type": e["type"]})

    # Relations → edges
    seen_edges: set[tuple] = set()
    edges = []
    for rel in root.findall("relation"):
        e1 = entry_map.get(rel.get("entry1", ""))
        e2 = entry_map.get(rel.get("entry2", ""))
        if not e1 or not e2:
            continue
        src, tgt = e1["id"], e2["id"]
        if not src or not tgt or src == tgt:
            continue
        subtypes = [s.get("name", "") for s in rel.findall("subtype")]
        indirect = any(s in ("indirect effect", "missing interaction") for s in subtypes)
        key = (src, tgt)
        if key not in seen_edges:
            seen_edges.add(key)
            edges.append({"source": src, "target": tgt, "indirect": indirect})

    return {"nodes": nodes, "edges": edges, "pathway_id": pathway_id}


def _classify_node(etype: str, label: str) -> str:
    if etype == "compound":
        return "compound"
    if etype == "map":
        return "pathway_ref"
    lower = label.lower()
    if any(k in lower for k in ("cancer", "proliferation", "apoptosis", "death", "survival", "growth", "senescence")):
        return "outcome"
    return "protein"


# ── Reactome fallback ─────────────────────────────────────────────

async def _reactome_graph(uniprot_id: str) -> Optional[dict]:
    """Build a simple pathway graph from Reactome for a UniProt accession."""
    try:
        url = f"{REACTOME_BASE}/data/pathways/low/entity/{uniprot_id}/allForms"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers={"Accept": "application/json"})
        if r.status_code != 200:
            return None
        pathways = r.json()
        if not pathways:
            return None

        pw = pathways[0]
        pw_id = pw.get("stId", "")
        pw_name = pw.get("displayName", "")

        # Get contained events (participants)
        part_url = f"{REACTOME_BASE}/data/pathway/{pw_id}/containedEvents"
        async with httpx.AsyncClient(timeout=20) as client:
            r2 = await client.get(part_url, headers={"Accept": "application/json"})
        if r2.status_code != 200:
            return None

        events = r2.json()
        seen: set[str] = set()
        nodes = []
        for ev in events[:20]:
            name = ev.get("displayName", "")
            if name and name not in seen:
                seen.add(name)
                nodes.append({"id": name, "type": "protein"})

        # Build a linear chain from event order
        edges = [
            {"source": nodes[i]["id"], "target": nodes[i + 1]["id"], "indirect": False}
            for i in range(len(nodes) - 1)
        ]

        return {"nodes": nodes, "edges": edges, "source": "reactome", "pathway_name": pw_name}
    except Exception as e:
        logger.warning(f"Reactome graph failed for {uniprot_id}: {e}")
        return None


# ── Graph utilities ───────────────────────────────────────────────

def _merge_graphs(graphs: list[dict]) -> dict:
    seen_nodes: dict[str, str] = {}
    seen_edges: set[tuple] = set()
    edges = []

    for g in graphs:
        for n in g.get("nodes", []):
            if n["id"] and n["id"] not in seen_nodes:
                seen_nodes[n["id"]] = n["type"]
        for e in g.get("edges", []):
            key = (e["source"], e["target"])
            if key not in seen_edges and e["source"] in seen_nodes and e["target"] in seen_nodes:
                seen_edges.add(key)
                edges.append(e)

    nodes = [{"id": k, "type": v} for k, v in seen_nodes.items()]
    return {"nodes": nodes, "edges": edges}


def _mark_driver(graph: dict, gene_symbol: str) -> dict:
    """Tag the focal gene node as 'driver'."""
    upper = gene_symbol.upper()
    for n in graph.get("nodes", []):
        if n["id"].upper() == upper:
            n["type"] = "driver"
    return graph


def _trim_graph(graph: dict, focal_gene: str, max_nodes: int = 30) -> dict:
    """
    Keep at most max_nodes nodes.

    Strategy: BFS from the focal gene. If that yields fewer than 8 nodes
    (poorly connected gene), fall back to the most-connected nodes in the
    largest connected component so the diagram is still informative.
    """
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    if len(nodes) <= max_nodes:
        return graph

    # Build undirected adjacency
    adj: dict[str, set[str]] = {}
    degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    for e in edges:
        adj.setdefault(e["source"], set()).add(e["target"])
        adj.setdefault(e["target"], set()).add(e["source"])
        degree[e["source"]] = degree.get(e["source"], 0) + 1
        degree[e["target"]] = degree.get(e["target"], 0) + 1

    focal_upper = focal_gene.upper()
    focal_id = next((n["id"] for n in nodes if n["id"].upper() == focal_upper), None)

    kept_ids: set[str] = set()

    if focal_id:
        visited: set[str] = {focal_id}
        q = deque([focal_id])
        while q and len(visited) < max_nodes:
            curr = q.popleft()
            for nb in adj.get(curr, set()):
                if nb not in visited:
                    visited.add(nb)
                    q.append(nb)
        kept_ids = visited

    # Fallback: if focal gene is poorly connected, use highest-degree nodes
    if len(kept_ids) < 8:
        top_nodes = sorted(degree.keys(), key=lambda x: -degree[x])[:max_nodes]
        kept_ids = set(top_nodes)
        # Always include focal gene if present
        if focal_id:
            kept_ids.add(focal_id)

    kept_nodes = [n for n in nodes if n["id"] in kept_ids]
    kept_edges = [e for e in edges if e["source"] in kept_ids and e["target"] in kept_ids]
    return {**graph, "nodes": kept_nodes, "edges": kept_edges}


# ── Public API ────────────────────────────────────────────────────

async def get_pathway_graph(
    gene_symbol: str,
    uniprot_id: str = "",
    max_pathways: int = 2,
) -> Optional[dict]:
    """
    Fetch a disease-specific pathway graph for a gene.

    Tries KEGG first, falls back to Reactome.
    Results are cached per gene for one week.

    Returns:
        {"nodes": [...], "edges": [...], "source": "kegg"|"reactome"} or None
    """
    cache_key = f"pathway_graph:{gene_symbol}:{uniprot_id}"
    cached = await pathway_cache.aget(cache_key)
    if cached is not None:
        return cached

    result = await _build_graph(gene_symbol, uniprot_id, max_pathways)
    if result:
        await pathway_cache.aset(cache_key, result)
    return result


def _prioritize_pathways(pathway_ids: list[str]) -> list[str]:
    """Put KEGG disease pathways (hsa05xxx) first — most relevant for drug discovery."""
    disease = [p for p in pathway_ids if "hsa05" in p]
    other = [p for p in pathway_ids if "hsa05" not in p]
    return disease + other


async def _build_graph(gene_symbol: str, uniprot_id: str, max_pathways: int) -> Optional[dict]:
    # ── 1. KEGG ──
    pathway_ids = await _kegg_pathway_ids(gene_symbol, uniprot_id)
    if pathway_ids:
        ordered = _prioritize_pathways(pathway_ids)
        tasks = [_kegg_kgml(pid) for pid in ordered[:max_pathways]]
        raw_graphs = await asyncio.gather(*tasks)
        valid = [g for g in raw_graphs if g and (g.get("nodes") or g.get("edges"))]
        if valid:
            merged = _merge_graphs(valid)
            if merged["nodes"]:
                merged["source"] = "kegg"
                merged = _mark_driver(merged, gene_symbol)
                return _trim_graph(merged, gene_symbol)

    # ── 2. Reactome fallback ──
    if uniprot_id:
        reactome = await _reactome_graph(uniprot_id)
        if reactome and reactome.get("nodes"):
            reactome = _mark_driver(reactome, gene_symbol)
            return _trim_graph(reactome, gene_symbol)

    return None
