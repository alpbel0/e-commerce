# chat_response.py - AI Service → Frontend Final Response schemas

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from enum import Enum


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ExecutionStepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ExecutionStepName(str, Enum):
    GUARDRAILS = "GUARDRAILS"
    SCHEMA_CONTEXT = "SCHEMA_CONTEXT"
    SQL_GENERATION = "SQL_GENERATION"
    SQL_VALIDATION = "SQL_VALIDATION"
    QUERY_EXECUTION = "QUERY_EXECUTION"
    ERROR_REPAIR = "ERROR_REPAIR"
    ANALYSIS = "ANALYSIS"
    VISUALIZATION = "VISUALIZATION"


class VisualizationType(str, Enum):
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    DONUT = "donut"


class ErrorCode(str, Enum):
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    PRIVACY_RISK = "PRIVACY_RISK"
    AUTHORIZATION_RISK = "AUTHORIZATION_RISK"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    DESTRUCTIVE_REQUEST = "DESTRUCTIVE_REQUEST"
    AMBIGUOUS_QUESTION = "AMBIGUOUS_QUESTION"
    SQL_VALIDATION_FAILED = "SQL_VALIDATION_FAILED"
    SQL_SCOPE_VIOLATION = "SQL_SCOPE_VIOLATION"
    SQL_EXECUTION_FAILED = "SQL_EXECUTION_FAILED"
    SQL_REPAIR_FAILED = "SQL_REPAIR_FAILED"
    QUERY_TIMEOUT = "QUERY_TIMEOUT"
    BACKEND_UNAVAILABLE = "BACKEND_UNAVAILABLE"
    SCHEMA_UNAVAILABLE = "SCHEMA_UNAVAILABLE"
    MODEL_ERROR = "MODEL_ERROR"


class ExecutionStepResponse(CamelModel):
    """One step in the execution pipeline"""
    name: ExecutionStepName
    status: ExecutionStepStatus
    message: str  # User-facing message


class TableResponse(CamelModel):
    """Query result table"""
    columns: list[str]
    rows: list[list]
    row_count: int


class VisualizationResponse(CamelModel):
    """Plotly-compatible chart specification"""
    type: Optional[VisualizationType] = None
    data: Optional[dict] = None  # Plotly JSON spec


class TechnicalResponse(CamelModel):
    """Technical details (shown in collapsed section)"""
    generated_sql: Optional[str] = None  # Only in technical details
    sql_summary: Optional[str] = None
    row_count: int = 0
    execution_ms: int = 0
    retry_count: int = 0


class ErrorResponse(CamelModel):
    """Error details when request fails"""
    code: ErrorCode
    message: str  # User-friendly message


class ChatFinalResponse(CamelModel):
    """Final response from AI Service to Frontend"""
    request_id: str
    answer: Optional[str] = None  # Natural language answer
    language: Optional[str] = None  # "tr" or "en"
    execution_steps: list[ExecutionStepResponse] = Field(default_factory=list)
    table: Optional[TableResponse] = None
    visualization: Optional[VisualizationResponse] = None
    technical: Optional[TechnicalResponse] = None
    error: Optional[ErrorResponse] = None

    # Response type discriminator
    def is_successful(self) -> bool:
        return self.error is None and self.answer is not None

    def is_rejection(self) -> bool:
        return self.error is not None

    def is_clarification(self) -> bool:
        return self.error is None and self.answer is not None and "?" in self.answer
