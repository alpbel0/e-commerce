"""Schema provider with caching and fallback support."""

import json
import logging
import time
from pathlib import Path
from typing import Optional

from app.config import settings
from app.services.ai_client import ai_client

logger = logging.getLogger(__name__)


class SchemaProvider:
    """
    Provides analytics schema to the AI service with caching and fallback support.

    The provider:
    1. Checks cache first (respects TTL)
    2. Fetches from backend /internal/schema endpoint if cache expired
    3. Falls back to local analytics_schema.json if backend unavailable
    4. Supports forced refresh via invalidate_cache()
    """

    def __init__(self):
        self._cache: Optional[dict] = None
        self._cache_time: float = 0
        self._cache_ttl = settings.schema_cache_ttl_seconds
        self._schema_version: Optional[str] = None
        self._fallback_schema: Optional[dict] = None

    def get_schema(self, force_refresh: bool = False) -> dict:
        """
        Get the analytics schema from synchronous code.

        Args:
            force_refresh: If True, bypass cache and fetch fresh from backend

        Returns:
            Schema dictionary
        """
        cached_schema = self._get_valid_cache(force_refresh)
        if cached_schema is not None:
            return cached_schema

        try:
            schema = self._fetch_from_backend_sync()
            if schema is not None:
                return self._store_cache(schema, "backend")
        except Exception as e:
            logger.warning(f"Failed to fetch schema from backend: {e}")

        return self._get_fallback_with_cache()

    async def get_schema_async(self, force_refresh: bool = False) -> dict:
        """
        Get the analytics schema from async workflows.

        This method is safe to call from FastAPI and LangGraph async nodes.
        """
        cached_schema = self._get_valid_cache(force_refresh)
        if cached_schema is not None:
            return cached_schema

        try:
            schema = await ai_client.get_schema()
            if schema is not None:
                return self._store_cache(schema, "backend")
        except Exception as e:
            logger.warning(f"Failed to fetch schema from backend: {e}")

        return self._get_fallback_with_cache()

    def _get_valid_cache(self, force_refresh: bool) -> Optional[dict]:
        current_time = time.time()

        if not force_refresh and self._cache is not None:
            if current_time - self._cache_time < self._cache_ttl:
                logger.debug(f"Returning cached schema (version: {self._schema_version})")
                return self._cache

        return None

    def _store_cache(self, schema: dict, source: str) -> dict:
        self._cache = schema
        self._cache_time = time.time()
        self._schema_version = schema.get("schemaVersion", "unknown")
        logger.info(f"Schema loaded from {source} (version: {self._schema_version})")
        return schema

    def _get_fallback_with_cache(self) -> dict:
        schema = self._load_fallback_schema()
        return self._store_cache(schema, "fallback")

    def _fetch_from_backend_sync(self) -> Optional[dict]:
        """Fetch schema from backend internal endpoint from sync code."""
        import asyncio

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(ai_client.get_schema())

        raise RuntimeError("Use get_schema_async() when an event loop is already running")

    def _load_fallback_schema(self) -> dict:
        """Load fallback schema from local JSON file."""
        if self._fallback_schema is not None:
            return self._fallback_schema

        schema_path = Path(__file__).parent.parent / "schema" / "analytics_schema.json"

        if not schema_path.exists():
            logger.error(f"Fallback schema not found at {schema_path}")
            return self._get_minimal_schema()

        with open(schema_path, "r", encoding="utf-8") as f:
            self._fallback_schema = json.load(f)

        return self._fallback_schema

    def _get_minimal_schema(self) -> dict:
        """Return a minimal schema if everything fails."""
        return {
            "schemaVersion": "error",
            "tables": [],
            "relationships": [],
            "roleRules": {
                "adminAccessibleTables": [],
                "corporateAccessibleTables": [],
                "individualAccessibleTables": [],
                "sensitiveColumns": [],
                "piiColumns": []
            }
        }

    def invalidate_cache(self) -> None:
        """Clear the schema cache and force refresh on next get_schema() call."""
        logger.info("Schema cache invalidated")
        self._cache = None
        self._cache_time = 0

    @property
    def schema_version(self) -> Optional[str]:
        """Get the current schema version."""
        return self._schema_version

    @property
    def is_cache_valid(self) -> bool:
        """Check if cache is currently valid."""
        if self._cache is None:
            return False
        return time.time() - self._cache_time < self._cache_ttl


# Singleton instance
schema_provider = SchemaProvider()
