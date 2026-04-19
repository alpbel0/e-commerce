"""In-memory session store with TTL-based expiration for conversation memory."""

import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from cachetools import TTLCache

from app.config import settings


@dataclass
class SessionMemory:
    """Memory structure for a session."""
    session_id: str
    memory: list[dict[str, str]] = field(default_factory=list)  # [{question, answer_summary}, ...]
    last_intent: Optional[str] = None
    last_sql_summary: Optional[str] = None
    last_accessed: float = field(default_factory=time.time)


class SessionStore:
    """
    Thread-safe in-memory session store with TTL expiration.

    Implements singleton pattern with lazy initialization.
    """

    _instance: Optional["SessionStore"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "SessionStore":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._cache: TTLCache[str, SessionMemory] = TTLCache(
            maxsize=10000,
            ttl=settings.session_idle_ttl_minutes * 60,  # Convert to seconds
        )
        self._access_lock = threading.RLock()
        self._initialized = True

    def get_memory(self, session_id: str) -> SessionMemory:
        """Get or create session memory."""
        with self._access_lock:
            if session_id not in self._cache:
                self._cache[session_id] = SessionMemory(session_id=session_id)
            mem = self._cache[session_id]
            mem.last_accessed = time.time()
            return mem

    def add_exchange(
        self,
        session_id: str,
        question: str,
        answer_summary: str,
        intent: Optional[str] = None,
        sql_summary: Optional[str] = None,
    ) -> None:
        """
        Add a user-assistant exchange to session memory.

        Memory is kept to last N pairs as configured.
        Answer is stored as summary (max 300 chars).
        """
        mem = self.get_memory(session_id)
        with self._access_lock:
            mem.memory.append({
                "question": question[:500],  # Sanitize: truncate long questions
                "answer_summary": answer_summary[:300],
            })
            # Keep only last N pairs
            if len(mem.memory) > settings.chat_memory_pairs:
                mem.memory = mem.memory[-settings.chat_memory_pairs:]
            if intent:
                mem.last_intent = intent
            if sql_summary:
                mem.last_sql_summary = sql_summary

    def get_conversation_context(
        self, session_id: str
    ) -> tuple[list[dict[str, str]], Optional[str], Optional[str]]:
        """
        Get conversation memory for context injection.

        Returns:
            Tuple of (memory_pairs, last_intent, last_sql_summary)
        """
        mem = self.get_memory(session_id)
        with self._access_lock:
            return (
                list(mem.memory),  # Return copy
                mem.last_intent,
                mem.last_sql_summary,
            )

    def clear_session(self, session_id: str) -> None:
        """Explicitly clear a session (e.g., on logout)."""
        with self._access_lock:
            if session_id in self._cache:
                del self._cache[session_id]


# Global singleton instance
session_store = SessionStore()
