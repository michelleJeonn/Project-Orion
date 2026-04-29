import json
import hashlib
import asyncio
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timedelta

from backend.config import settings
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class DiskCache:
    """Simple disk-based JSON cache with TTL support."""

    def __init__(self, namespace: str, ttl_hours: int = 24):
        self.cache_dir = settings.cache_dir / namespace
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = timedelta(hours=ttl_hours)

    def _key_path(self, key: str) -> Path:
        hashed = hashlib.sha256(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed}.json"

    def get(self, key: str) -> Optional[Any]:
        path = self._key_path(key)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            stored_at = datetime.fromisoformat(data["stored_at"])
            if datetime.utcnow() - stored_at > self.ttl:
                path.unlink(missing_ok=True)
                return None
            return data["value"]
        except Exception as e:
            logger.warning(f"Cache read error for {key}: {e}")
            return None

    def set(self, key: str, value: Any) -> None:
        path = self._key_path(key)
        try:
            path.write_text(
                json.dumps({"stored_at": datetime.utcnow().isoformat(), "value": value})
            )
        except Exception as e:
            logger.warning(f"Cache write error for {key}: {e}")

    async def aget(self, key: str) -> Optional[Any]:
        return await asyncio.to_thread(self.get, key)

    async def aset(self, key: str, value: Any) -> None:
        await asyncio.to_thread(self.set, key, value)


# Shared caches by namespace
protein_cache = DiskCache("proteins", ttl_hours=168)   # 1 week
pubmed_cache = DiskCache("pubmed", ttl_hours=48)
chembl_cache = DiskCache("chembl", ttl_hours=48)
docking_cache = DiskCache("docking", ttl_hours=72)
