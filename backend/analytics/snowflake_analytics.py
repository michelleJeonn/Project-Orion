"""
Snowflake Chemical Intelligence Analytics

Responsibilities
────────────────
• store_molecules()      — batch-insert molecule features + VECTOR after docking
• store_report()         — persist flattened GenesisReport for RAG search
• similar_molecules()    — VECTOR_L2_DISTANCE nearest-neighbour search
• chemical_space_pca()   — PCA(3D) projection for the Chemical Space Explorer
• cross_run_analytics()  — method / target / disease leaderboards
• search_reports()       — ILIKE keyword fallback (Cortex-ready stub)
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from backend.services.snowflake_client import get_connection, is_available

logger = logging.getLogger(__name__)

# ── helpers ──────────────────────────────────────────────────────────────────

def _safe_float(val, fallback: float = 0.0) -> float:
    try:
        return float(val) if val is not None else fallback
    except (TypeError, ValueError):
        return fallback


def _vec_literal(values: list[float]) -> str:
    """Build a Snowflake VECTOR literal: [1.0,2.0,...]::VECTOR(FLOAT,9)"""
    inner = ",".join(f"{v:.6f}" for v in values)
    return f"[{inner}]::VECTOR(FLOAT, 9)"


def _build_feature_vector(row: dict) -> list[float]:
    return [
        _safe_float(row.get("qed")),
        _safe_float(row.get("logp")),
        _safe_float(row.get("molecular_weight")),
        _safe_float(row.get("tpsa")),
        _safe_float(row.get("h_donors")),
        _safe_float(row.get("h_acceptors")),
        _safe_float(row.get("rotatable_bonds")),
        _safe_float(row.get("sa_score")),
        _safe_float(row.get("binding_score")),
    ]


# ── Main class ────────────────────────────────────────────────────────────────

class SnowflakeAnalytics:

    # ── Write: molecules ─────────────────────────────────────────────────── #

    def store_molecules(
        self,
        job_id: str,
        disease: str,
        docking_results_per_target: dict[str, list[dict]],
    ) -> None:
        """
        Batch-insert every docked molecule into MOLECULE_FEATURES.
        Never raises — logs a warning and returns on any Snowflake failure.
        """
        if not is_available():
            logger.info("Snowflake unavailable, skipping molecule storage")
            return

        rows: list[dict] = []
        for target_uid, results in docking_results_per_target.items():
            for r in results:
                mol = r.get("molecule", {})
                admet = mol.get("admet", {})
                row = {
                    "job_id":           job_id,
                    "disease":          disease,
                    "target":           target_uid,
                    "molecule_id":      mol.get("molecule_id", ""),
                    "smiles":           mol.get("smiles", ""),
                    "qed":              _safe_float(admet.get("qed_score")),
                    "logp":             _safe_float(admet.get("log_p")),
                    "tpsa":             _safe_float(admet.get("tpsa")),
                    "sa_score":         _safe_float(admet.get("synthetic_accessibility")),
                    "binding_score":    _safe_float(r.get("binding_affinity_kcal")),
                    "molecular_weight": _safe_float(admet.get("mw")),
                    "h_donors":         _safe_float(admet.get("hbd")),
                    "h_acceptors":      _safe_float(admet.get("hba")),
                    "rotatable_bonds":  _safe_float(admet.get("rotatable_bonds")),
                    "generation_method": mol.get("generation_method", "unknown"),
                }
                rows.append(row)

        if not rows:
            logger.info("No molecules to store in Snowflake")
            return

        try:
            with get_connection() as conn:
                cur = conn.cursor()
                inserted = 0
                for row in rows:
                    vec = _build_feature_vector(row)
                    vec_lit = _vec_literal(vec)
                    cur.execute(
                        f"""
                        INSERT INTO MOLECULE_FEATURES (
                            job_id, disease, target, molecule_id, smiles,
                            qed, logp, tpsa, sa_score, binding_score,
                            molecular_weight, h_donors, h_acceptors,
                            rotatable_bonds, generation_method, feature_vector
                        ) VALUES (
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, {vec_lit}
                        )
                        """,
                        (
                            row["job_id"], row["disease"], row["target"],
                            row["molecule_id"], row["smiles"],
                            row["qed"], row["logp"], row["tpsa"],
                            row["sa_score"], row["binding_score"],
                            row["molecular_weight"], row["h_donors"],
                            row["h_acceptors"], row["rotatable_bonds"],
                            row["generation_method"],
                        ),
                    )
                    inserted += 1
                conn.commit()
                cur.close()
            logger.info(f"Stored {inserted} molecules in Snowflake for job {job_id}")
        except Exception as exc:
            logger.warning(f"Snowflake molecule store failed for job {job_id}: {exc}")

    # ── Write: report ────────────────────────────────────────────────────── #

    def store_report(self, job_id: str, disease: str, report: dict) -> None:
        """
        Persist the final GenesisReport in GENESIS_REPORTS.
        Flattens report into searchable text fields.
        """
        if not is_available():
            logger.info("Snowflake unavailable, skipping report storage")
            return

        try:
            # Flatten report into text fields for keyword search
            executive_summary = report.get("executive_summary", "")
            methodology_notes = report.get("methodology_notes", "")
            safety_text = " | ".join(report.get("safety_flags", []))
            limitations_text = " | ".join(report.get("limitations", []))

            pathway_parts: list[str] = []
            rationale_parts: list[str] = []
            for insight in report.get("target_insights", []):
                pathway_parts.append(insight.get("pathway_relevance", ""))
                pathway_parts.append(insight.get("mechanism_of_action", ""))
                rationale_parts.append(insight.get("clinical_context", ""))
            for candidate in report.get("top_candidates", [])[:5]:
                rationale_parts.append(candidate.get("explanation", ""))

            report_text = " ".join(filter(None, [
                executive_summary, methodology_notes,
                safety_text, limitations_text,
            ]))
            pathway_summary = " ".join(filter(None, pathway_parts))
            molecule_rationale = " ".join(filter(None, rationale_parts))

            with get_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO GENESIS_REPORTS (
                        job_id, disease, report_json,
                        report_text, pathway_summary, molecule_rationale
                    ) SELECT %s, %s, PARSE_JSON(%s), %s, %s, %s
                    """,
                    (
                        job_id, disease, json.dumps(report),
                        report_text, pathway_summary, molecule_rationale,
                    ),
                )
                conn.commit()
                cur.close()
            logger.info(f"Stored report in Snowflake for job {job_id}")
        except Exception as exc:
            logger.warning(f"Snowflake report store failed for job {job_id}: {exc}")

    # ── Read: vector similarity ──────────────────────────────────────────── #

    def similar_molecules(
        self,
        job_id: str,
        molecule_id: str,
        top_k: int = 10,
    ) -> list[dict]:
        """
        Return top-K nearest molecules by VECTOR_L2_DISTANCE across all jobs.
        Falls back to empty list if Snowflake is unavailable.
        """
        if not is_available():
            return []
        try:
            with get_connection() as conn:
                cur = conn.cursor()

                # 1. Fetch query vector
                cur.execute(
                    "SELECT feature_vector FROM MOLECULE_FEATURES "
                    "WHERE job_id = %s AND molecule_id = %s LIMIT 1",
                    (job_id, molecule_id),
                )
                row = cur.fetchone()
                if not row:
                    cur.close()
                    return []

                # row[0] is the VECTOR value; cast back to list via TO_ARRAY
                cur.execute(
                    f"""
                    SELECT
                        molecule_id, smiles, disease, target,
                        qed, binding_score, generation_method,
                        VECTOR_L2_DISTANCE(
                            feature_vector,
                            (SELECT feature_vector FROM MOLECULE_FEATURES
                             WHERE job_id = %s AND molecule_id = %s LIMIT 1)
                        ) AS l2_dist
                    FROM MOLECULE_FEATURES
                    WHERE molecule_id != %s
                    ORDER BY l2_dist ASC
                    LIMIT {int(top_k)}
                    """,
                    (job_id, molecule_id, molecule_id),
                )
                cols = [d[0].lower() for d in cur.description]
                results = []
                for r in cur.fetchall():
                    rec = dict(zip(cols, r))
                    # Convert distance to a 0-1 similarity score
                    dist = float(rec.get("l2_dist", 1.0))
                    rec["similarity_score"] = round(1.0 / (1.0 + dist), 4)
                    results.append(rec)
                cur.close()
                return results
        except Exception as exc:
            logger.warning(f"Snowflake similarity search failed: {exc}")
            return []

    # ── Read: PCA chemical space ─────────────────────────────────────────── #

    def chemical_space_pca(self, job_id: str) -> list[dict]:
        """
        Fetch molecules for a job, run PCA(3D) on feature vectors,
        return list of {molecule_id, x, y, z, smiles, qed, binding_score,
        generation_method, target, disease}.
        """
        if not is_available():
            return []
        try:
            with get_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT
                        molecule_id, smiles, disease, target,
                        qed, logp, molecular_weight, tpsa,
                        h_donors, h_acceptors, rotatable_bonds,
                        sa_score, binding_score, generation_method
                    FROM MOLECULE_FEATURES
                    WHERE job_id = %s
                    """,
                    (job_id,),
                )
                cols = [d[0].lower() for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                cur.close()

            if len(rows) < 3:
                return []

            import numpy as np
            from sklearn.preprocessing import StandardScaler
            from sklearn.decomposition import PCA

            feature_cols = [
                "qed", "logp", "molecular_weight", "tpsa",
                "h_donors", "h_acceptors", "rotatable_bonds",
                "sa_score", "binding_score",
            ]
            X = np.array(
                [[_safe_float(r.get(c)) for c in feature_cols] for r in rows],
                dtype=float,
            )

            # Standardise before PCA
            X_scaled = StandardScaler().fit_transform(X)
            n_components = min(3, X_scaled.shape[1], X_scaled.shape[0])
            pca = PCA(n_components=n_components)
            coords = pca.fit_transform(X_scaled)

            # Pad to 3D if fewer components
            if coords.shape[1] < 3:
                pad = np.zeros((coords.shape[0], 3 - coords.shape[1]))
                coords = np.hstack([coords, pad])

            points = []
            for i, row in enumerate(rows):
                points.append({
                    "molecule_id":       row.get("molecule_id", ""),
                    "x":                 round(float(coords[i, 0]), 4),
                    "y":                 round(float(coords[i, 1]), 4),
                    "z":                 round(float(coords[i, 2]), 4),
                    "smiles":            row.get("smiles", ""),
                    "qed":               _safe_float(row.get("qed")),
                    "binding_score":     _safe_float(row.get("binding_score")),
                    "generation_method": row.get("generation_method", ""),
                    "target":            row.get("target", ""),
                    "disease":           row.get("disease", ""),
                })

            logger.info(
                f"Generated PCA chemical space from Snowflake: "
                f"{len(points)} points for job {job_id}"
            )
            return points

        except Exception as exc:
            logger.warning(f"Snowflake PCA chemical space failed: {exc}")
            return []

    # ── Read: cross-run analytics ────────────────────────────────────────── #

    def cross_run_analytics(self) -> dict[str, Any]:
        """
        Return leaderboard analytics across all jobs:
        - best generation method
        - top targets by avg QED
        - disease candidate strength
        Falls back to empty dicts on failure.
        """
        if not is_available():
            logger.info("Snowflake unavailable, skipping analytics")
            return {"generation_methods": [], "targets": [], "diseases": []}
        try:
            with get_connection() as conn:
                cur = conn.cursor()

                # 1 — Generation method performance
                cur.execute(
                    """
                    SELECT
                        generation_method,
                        AVG(binding_score)  AS avg_binding,
                        AVG(qed)            AS avg_qed,
                        COUNT(*)            AS molecule_count
                    FROM MOLECULE_FEATURES
                    GROUP BY generation_method
                    ORDER BY avg_binding ASC
                    """
                )
                gen_methods = [
                    {
                        "method":         r[0],
                        "avg_binding":    round(float(r[1] or 0), 3),
                        "avg_qed":        round(float(r[2] or 0), 3),
                        "molecule_count": int(r[3]),
                    }
                    for r in cur.fetchall()
                ]

                # 2 — Target performance by avg QED
                cur.execute(
                    """
                    SELECT
                        target,
                        AVG(qed)            AS avg_qed,
                        AVG(binding_score)  AS avg_binding,
                        COUNT(*)            AS molecule_count
                    FROM MOLECULE_FEATURES
                    GROUP BY target
                    ORDER BY avg_qed DESC
                    LIMIT 20
                    """
                )
                targets = [
                    {
                        "target":         r[0],
                        "avg_qed":        round(float(r[1] or 0), 3),
                        "avg_binding":    round(float(r[2] or 0), 3),
                        "molecule_count": int(r[3]),
                    }
                    for r in cur.fetchall()
                ]

                # 3 — Disease leaderboard
                cur.execute(
                    """
                    SELECT
                        disease,
                        MIN(binding_score)  AS best_binding,
                        AVG(qed)            AS avg_qed,
                        COUNT(*)            AS molecule_count
                    FROM MOLECULE_FEATURES
                    GROUP BY disease
                    ORDER BY best_binding ASC
                    LIMIT 20
                    """
                )
                diseases = [
                    {
                        "disease":        r[0],
                        "best_binding":   round(float(r[1] or 0), 3),
                        "avg_qed":        round(float(r[2] or 0), 3),
                        "molecule_count": int(r[3]),
                    }
                    for r in cur.fetchall()
                ]

                cur.close()

            return {
                "generation_methods": gen_methods,
                "targets":            targets,
                "diseases":           diseases,
            }
        except Exception as exc:
            logger.warning(f"Snowflake analytics failed: {exc}")
            return {"generation_methods": [], "targets": [], "diseases": []}

    # ── Read: report RAG / search ────────────────────────────────────────── #

    def search_reports(self, query: str, limit: int = 10) -> list[dict]:
        """
        Keyword search over GENESIS_REPORTS using SQL ILIKE.
        Structured to swap in Cortex Search / hybrid vector search later.
        Returns list of {job_id, disease, matched_section, snippet, created_at}.
        """
        if not is_available():
            return []
        if not query or not query.strip():
            return []

        try:
            with get_connection() as conn:
                cur = conn.cursor()
                like = f"%{query.strip()}%"

                cur.execute(
                    f"""
                    SELECT
                        job_id, disease, created_at,
                        CASE
                            WHEN report_text       ILIKE %s THEN 'report_text'
                            WHEN pathway_summary   ILIKE %s THEN 'pathway_summary'
                            WHEN molecule_rationale ILIKE %s THEN 'molecule_rationale'
                            ELSE 'report_text'
                        END AS matched_section,
                        CASE
                            WHEN report_text ILIKE %s
                                THEN SUBSTR(report_text, 1, 300)
                            WHEN pathway_summary ILIKE %s
                                THEN SUBSTR(pathway_summary, 1, 300)
                            ELSE SUBSTR(molecule_rationale, 1, 300)
                        END AS snippet
                    FROM GENESIS_REPORTS
                    WHERE
                        report_text        ILIKE %s
                     OR pathway_summary    ILIKE %s
                     OR molecule_rationale ILIKE %s
                    ORDER BY created_at DESC
                    LIMIT {int(limit)}
                    """,
                    (like, like, like, like, like, like, like, like),
                )
                cols = [d[0].lower() for d in cur.description]
                results = [dict(zip(cols, r)) for r in cur.fetchall()]
                cur.close()

            # Normalise created_at to string
            for r in results:
                if r.get("created_at"):
                    r["created_at"] = str(r["created_at"])
            return results
        except Exception as exc:
            logger.warning(f"Snowflake report search failed: {exc}")
            return []


# ── Module-level singleton ────────────────────────────────────────────────── #
snowflake_analytics = SnowflakeAnalytics()
