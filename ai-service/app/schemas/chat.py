"""Chat request/response Pydantic models shared with the Spring/Angular contract."""

from datetime import date
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RoleType(str, Enum):
    ADMIN = "ADMIN"
    CORPORATE = "CORPORATE"
    INDIVIDUAL = "INDIVIDUAL"


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


class StoreInfo(CamelModel):
    id: str
    name: str


class AccessScope(CamelModel):
    owned_stores: list[StoreInfo] = Field(default_factory=list)


class UserContext(CamelModel):
    user_id: str
    email: str
    role: RoleType


class ConversationMessage(CamelModel):
    role: str
    content: str


class ChatRequest(CamelModel):
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str
    message: str
    current_date: date
    user: UserContext
    access_scope: AccessScope
    conversation: Optional[list[ConversationMessage]] = Field(default_factory=list)


class ExecutionStepResponse(CamelModel):
    name: ExecutionStepName
    status: ExecutionStepStatus
    message: str
    debug_message: Optional[str] = None


class TableResponse(CamelModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool = False


class VisualizationResponse(CamelModel):
    type: Optional[str] = None
    data: Optional[dict] = None


class TechnicalResponse(CamelModel):
    generated_sql: Optional[str] = None
    sql_summary: Optional[str] = None
    row_count: int = 0
    execution_ms: int = 0
    retry_count: int = 0


class ErrorResponse(CamelModel):
    code: ErrorCode
    message: str


class ChatResponse(CamelModel):
    request_id: str
    answer: Optional[str] = None
    language: Optional[str] = None
    execution_steps: list[ExecutionStepResponse] = Field(default_factory=list)
    table: Optional[TableResponse] = None
    visualization: Optional[VisualizationResponse] = None
    technical: Optional[TechnicalResponse] = None
    error: Optional[ErrorResponse] = None
