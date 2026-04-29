"""
Snowflake Chemical Intelligence Layer — connection management and DDL.

Tables:
  MOLECULE_FEATURES  — per-molecule property warehouse with VECTOR(FLOAT,9)
  GENESIS_REPORTS    — flattened report text for keyword / Cortex search
"""
import os
import logging
from contextlib import contextmanager
from typing import Optional, Any

from backend.config import settings

logger = logging.getLogger(__name__)

# ── Optional import ────────────────────────────────────────────────────────── #
_SF_AVAILABLE = False
try:
    import snowflake.connector  # noqa: F401
    _SF_AVAILABLE = True
except ImportError:
    logger.warning(
        "snowflake-connector-python not installed; "
        "Snowflake Chemical Intelligence Layer disabled."
    )


# ── Config ─────────────────────────────────────────────────────────────────── #

def _cfg() -> Optional[dict]:
    """Return connector kwargs from env vars/settings, or None if any key is missing."""
    env_to_settings = {
        "SNOWFLAKE_USER": "snowflake_user",
        "SNOWFLAKE_PASSWORD": "snowflake_password",
        "SNOWFLAKE_ACCOUNT": "snowflake_account",
        "SNOWFLAKE_WAREHOUSE": "snowflake_warehouse",
        "SNOWFLAKE_DATABASE": "snowflake_database",
        "SNOWFLAKE_SCHEMA": "snowflake_schema",
    }
    vals = {}
    for env_key, settings_key in env_to_settings.items():
        vals[env_key] = os.environ.get(env_key) or getattr(settings, settings_key, "")
    if not all(vals.values()):
        return None
    return {
        "user":      vals["SNOWFLAKE_USER"],
        "password":  vals["SNOWFLAKE_PASSWORD"],
        "account":   vals["SNOWFLAKE_ACCOUNT"],
        "warehouse": vals["SNOWFLAKE_WAREHOUSE"],
        "database":  vals["SNOWFLAKE_DATABASE"],
        "schema":    vals["SNOWFLAKE_SCHEMA"],
    }


def is_available() -> bool:
    """True when the connector is installed and all env vars are present."""
    return _SF_AVAILABLE and _cfg() is not None


def status() -> dict[str, Any]:
    """
    Return Snowflake readiness diagnostics without exposing secrets.
    Includes connector/config state and a lightweight connectivity check.
    """
    required = [
        "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD", "SNOWFLAKE_ACCOUNT",
        "SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_DATABASE", "SNOWFLAKE_SCHEMA",
    ]
    cfg = _cfg()
    missing = [k for k in required if not (os.environ.get(k) or getattr(settings, k.lower(), ""))]
    out: dict[str, Any] = {
        "connector_installed": _SF_AVAILABLE,
        "configured": cfg is not None,
        "available": is_available(),
        "missing_keys": missing,
        "connection_ok": False,
        "error": None,
    }
    if not out["available"]:
        return out
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT CURRENT_ACCOUNT(), CURRENT_REGION(), CURRENT_WAREHOUSE()")
            row = cur.fetchone()
            cur.close()
        out["connection_ok"] = True
        out["account"] = row[0] if row else None
        out["region"] = row[1] if row else None
        out["warehouse"] = row[2] if row else None
    except Exception as exc:
        out["error"] = str(exc)
    return out


@contextmanager
def get_connection():
    """Yield an open Snowflake connection; close it on exit."""
    if not _SF_AVAILABLE:
        raise RuntimeError("snowflake-connector-python not installed")
    cfg = _cfg()
    if not cfg:
        raise RuntimeError(
            "Snowflake env vars incomplete. "
            "Set SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT, "
            "SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA."
        )
    import snowflake.connector
    conn = snowflake.connector.connect(**cfg)
    try:
        yield conn
    finally:
        conn.close()


# ── DDL ────────────────────────────────────────────────────────────────────── #

_DDL_MOLECULE_FEATURES = """
CREATE TABLE IF NOT EXISTS MOLECULE_FEATURES (
    job_id              STRING,
    disease             STRING,
    target              STRING,
    molecule_id         STRING,
    smiles              STRING,
    qed                 FLOAT,
    logp                FLOAT,
    tpsa                FLOAT,
    sa_score            FLOAT,
    binding_score       FLOAT,
    molecular_weight    FLOAT,
    h_donors            FLOAT,
    h_acceptors         FLOAT,
    rotatable_bonds     FLOAT,
    generation_method   STRING,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
"""

# Columns added after initial schema — safe to run repeatedly
_DDL_MOLECULE_FEATURES_MIGRATIONS = [
    "ALTER TABLE MOLECULE_FEATURES ADD COLUMN IF NOT EXISTS molecular_weight FLOAT",
    "ALTER TABLE MOLECULE_FEATURES ADD COLUMN IF NOT EXISTS h_donors FLOAT",
    "ALTER TABLE MOLECULE_FEATURES ADD COLUMN IF NOT EXISTS h_acceptors FLOAT",
    "ALTER TABLE MOLECULE_FEATURES ADD COLUMN IF NOT EXISTS rotatable_bonds FLOAT",
    "ALTER TABLE MOLECULE_FEATURES ADD COLUMN IF NOT EXISTS generation_method STRING",
]

_DDL_GENESIS_REPORTS = """
CREATE TABLE IF NOT EXISTS GENESIS_REPORTS (
    job_id              STRING,
    disease             STRING,
    report_json         VARIANT,
    report_text         STRING,
    pathway_summary     STRING,
    molecule_rationale  STRING,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
"""


def init_snowflake_tables() -> None:
    """Create warehouse tables when the app starts up. No-op if unavailable."""
    if not is_available():
        logger.info("Snowflake not configured — skipping table initialisation")
        return
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(_DDL_MOLECULE_FEATURES)
            cur.execute(_DDL_GENESIS_REPORTS)
            for migration in _DDL_MOLECULE_FEATURES_MIGRATIONS:
                try:
                    cur.execute(migration)
                except Exception:
                    pass  # column already exists or not supported — safe to ignore
            cur.close()
        logger.info("Snowflake tables ready (MOLECULE_FEATURES, GENESIS_REPORTS)")
    except Exception as exc:
        logger.warning(f"Snowflake table init failed: {exc}")
