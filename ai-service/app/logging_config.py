"""Structured logging configuration for AI service."""

import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import settings


def sanitize_sql(sql: Optional[str]) -> str:
    """
    Sanitize SQL for logging.

    In dev: return SQL as-is (truncated to 1000 chars)
    In demo/prod: return hash + summary + length only
    """
    if not sql:
        return ""

    if settings.app_env == "dev":
        # Full SQL in dev, truncated
        return sql[:1000]

    # Demo/prod: hash + metadata only
    sql_hash = hashlib.sha256(sql.encode()).hexdigest()[:16]
    sql_lower = sql.lower()

    # Extract key operations (SELECT, aggregations, table names)
    tables = []
    for keyword in ["from", "join"]:
        idx = sql_lower.find(keyword)
        if idx >= 0:
            end = min(idx + len(keyword) + 20, len(sql))
            segment = sql[idx:end].split()[1:] if len(sql[idx:end].split()) > 1 else []
            tables.extend([w.strip(",;") for w in segment[:3]])

    return f"[SQL hash={sql_hash}, tables={tables}, len={len(sql)}]"


def sanitize_value(value: Any, max_len: int = 100) -> str:
    """Sanitize a generic value for logging."""
    if value is None:
        return "null"
    s = str(value)
    if len(s) > max_len:
        return s[:max_len] + "..."
    return s


def log_safe_row_count(count: Optional[int]) -> int:
    """Return row count safely (never actual rows)."""
    return count or 0


class AIServiceLogFormatter(logging.Formatter):
    """
    JSON structured formatter for AI service logs.

    Ensures consistent fields across all log entries:
    - timestamp, level, logger, message
    - request_id, session_id, user_id, user_role (when available)
    - Additional context via extra dict
    """

    def __init__(self, app_env: str = "dev"):
        super().__init__()
        self.app_env = app_env

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add correlation IDs if present
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if hasattr(record, "session_id"):
            log_entry["session_id"] = record.session_id
        if hasattr(record, "user_id"):
            log_entry["user_id"] = sanitize_value(record.user_id, max_len=50)
        if hasattr(record, "user_role"):
            log_entry["user_role"] = record.user_role

        # Add intent/language if present
        if hasattr(record, "intent"):
            log_entry["intent"] = record.intent
        if hasattr(record, "language"):
            log_entry["language"] = record.language

        # Add SQL info (sanitized)
        if hasattr(record, "sql_query"):
            log_entry["sql_query"] = sanitize_sql(record.sql_query)
        if hasattr(record, "sql_summary"):
            log_entry["sql_summary"] = record.sql_summary
        if hasattr(record, "row_count"):
            log_entry["row_count"] = log_safe_row_count(record.row_count)

        # Add step info
        if hasattr(record, "step_name"):
            log_entry["step_name"] = record.step_name
        if hasattr(record, "step_status"):
            log_entry["step_status"] = record.step_status

        # Add error/retry info
        if hasattr(record, "error_code"):
            log_entry["error_code"] = record.error_code
        if hasattr(record, "retry_count"):
            log_entry["retry_count"] = record.retry_count

        # Add selected schema tables
        if hasattr(record, "schema_tables"):
            log_entry["schema_tables"] = record.schema_tables

        # Add execution timing
        if hasattr(record, "execution_ms"):
            log_entry["execution_ms"] = record.execution_ms

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


class AIServiceLoggerAdapter(logging.LoggerAdapter):
    """
    Custom logger adapter that adds structured context fields.

    Usage:
        logger = get_ai_logger(__name__, request_id="xxx", session_id="yyy")
        logger.info("Processing request", intent="IN_SCOPE_ANALYTICS", sql_query=sql)
    """

    def process(self, msg: str, kwargs: dict) -> tuple[str, dict]:
        # Python's stdlib logger only accepts a fixed kwargs set. Treat any
        # domain-specific keyword as structured context and move it into extra.
        reserved_logging_kwargs = {"exc_info", "stack_info", "stacklevel", "extra"}
        dynamic_extra = {
            key: kwargs.pop(key)
            for key in list(kwargs.keys())
            if key not in reserved_logging_kwargs
        }

        extra = kwargs.get("extra", {})
        extra.update(dynamic_extra)
        extra.update(self.extra)
        kwargs["extra"] = extra
        return msg, kwargs


def get_ai_logger(
    name: str,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
    intent: Optional[str] = None,
    language: Optional[str] = None,
) -> AIServiceLoggerAdapter:
    """
    Get a structured logger with common fields pre-populated.

    These fields will be included in every log message from the returned logger.
    """
    extra = {}
    if request_id:
        extra["request_id"] = request_id
    if session_id:
        extra["session_id"] = session_id
    if user_id:
        extra["user_id"] = sanitize_value(user_id, max_len=50)
    if user_role:
        extra["user_role"] = user_role
    if intent:
        extra["intent"] = intent
    if language:
        extra["language"] = language

    logger = logging.getLogger(name)
    return AIServiceLoggerAdapter(logger, extra)


def setup_logging() -> None:
    """Configure logging for the AI service application."""

    # Determine log level from environment
    log_level = logging.DEBUG if settings.app_env == "dev" else logging.INFO

    # Create formatter
    formatter = AIServiceLogFormatter(app_env=settings.app_env)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    root_logger.addHandler(console_handler)

    # Set third-party loggers to WARNING to reduce noise
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)

    logging.info(f"Logging configured for environment: {settings.app_env}")
