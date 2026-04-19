# query_executor.py - AI Service → Backend Query Executor Request/Response schemas

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date
from enum import Enum


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RoleType(str, Enum):
    ADMIN = "ADMIN"
    CORPORATE = "CORPORATE"
    INDIVIDUAL = "INDIVIDUAL"


class ExecutionPolicy(str, Enum):
    ANALYTICS_ONLY = "ANALYTICS_ONLY"


class QueryParameters(CamelModel):
    """Named placeholder parameters that AI should use in SQL"""
    current_user_id: str
    allowed_store_ids: list[str] = Field(default_factory=list)
    selected_store_id: Optional[str] = None
    start_date: Optional[date] = None  # YYYY-MM-DD
    end_date: Optional[date] = None  # YYYY-MM-DD
    limit: int = 100


class UserContext(CamelModel):
    """User context from AI service perspective"""
    user_id: str
    email: str = ""
    role: RoleType


class QueryExecutorRequest(CamelModel):
    """Request from AI Service to Backend Query Executor"""
    request_id: str
    sql: str  # SQL with named placeholders like :allowedStoreIds
    parameters: QueryParameters
    user_context: UserContext
    execution_policy: ExecutionPolicy = ExecutionPolicy.ANALYTICS_ONLY


class QueryExecutorResponse(CamelModel):
    """Response from Backend Query Executor to AI Service"""
    request_id: str
    columns: Optional[list[str]] = None
    rows: Optional[list[list]] = None
    row_count: int = 0
    execution_ms: int = 0
    error: Optional[str] = None  # Error code string if failed
