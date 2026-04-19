"""FastAPI application for e-commerce AI service."""

import logging
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.graph.state import AgentState
from app.graph.workflow import compile_workflow
from app.logging_config import setup_logging
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ErrorCode,
    ErrorResponse,
    ExecutionStepName,
    ExecutionStepResponse,
    ExecutionStepStatus,
    TableResponse,
    TechnicalResponse,
    VisualizationResponse,
)
from app.schemas.health import HealthResponse
from app.services.mock_service import mock_service
from app.services.session_store import session_store

app = FastAPI(
    title="ecommerce-ai-service",
    description="Multi-Agent Text2SQL AI Chatbot for E-Commerce Analytics",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    """Root endpoint."""
    return {"service": "ecommerce-ai-service", "status": "running"}


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        environment=settings.app_env,
        backend_base_url=settings.backend_base_url,
        mock_mode=settings.is_mock_mode,
    )


@app.post("/chat/ask", response_model=ChatResponse, tags=["chat"])
async def chat_ask(
    request: ChatRequest,
    x_ai_service_key: Optional[str] = Header(None, alias="X-AI-Service-Key"),
) -> ChatResponse:
    """
    Chat endpoint for natural language to SQL processing.

    Mock mode returns deterministic mock responses. Non-mock mode validates the
    internal shared secret and runs the LangGraph workflow.
    """
    if settings.is_mock_mode:
        response = mock_service.generate_response(
            request_id=request.request_id,
            message=request.message,
            role=request.user.role,
            allowed_stores=[store.name for store in request.access_scope.owned_stores],
        )
        # Update session memory for mock responses too
        if response.answer:
            session_store.add_exchange(
                session_id=request.session_id,
                question=request.message,
                answer_summary=response.answer[:300],
            )
        return response

    if not settings.ai_service_key or x_ai_service_key != settings.ai_service_key:
        raise HTTPException(status_code=403, detail="Invalid AI service key")

    initial_state = _request_to_state(request)
    graph = compile_workflow()
    result = await graph.ainvoke(initial_state)

    # Update session memory with this exchange
    response_data = result if isinstance(result, dict) else result.__dict__
    final_answer = response_data.get("final_answer") or ""
    if final_answer and len(final_answer) > 0:
        session_store.add_exchange(
            session_id=request.session_id,
            question=request.message,
            answer_summary=final_answer[:300],
            intent=response_data.get("intent"),
            sql_summary=response_data.get("sql_summary"),
        )

    return _graph_result_to_response(request.request_id, result)


def _request_to_state(request: ChatRequest) -> AgentState:
    # Prefer request-scoped conversation passed by the backend/frontend so
    # follow-up questions survive AI-service restarts and stale in-memory state.
    request_memory = _compact_conversation(request)
    session_memory, _, _ = session_store.get_conversation_context(request.session_id)
    memory_pairs = request_memory or session_memory

    user_role = request.user.role.value
    allowed_store_ids = (
        [store.id for store in request.access_scope.owned_stores]
        if user_role == "CORPORATE"
        else []
    )

    return AgentState(
        request_id=request.request_id,
        question=request.message,
        current_date=str(request.current_date),
        user_id=request.user.user_id,
        user_email=request.user.email,
        user_role=user_role,
        allowed_store_ids=allowed_store_ids,
        conversation_memory=memory_pairs,
    )


def _compact_conversation(request: ChatRequest) -> list[dict[str, str]]:
    messages = (request.conversation or [])[-8:]
    compact: list[dict[str, str]] = []
    current_question: Optional[str] = None
    for message in messages:
        if message.role.lower() == "user":
            current_question = message.content
        elif message.role.lower() == "assistant" and current_question:
            compact.append({
                "question": current_question,
                "answer_summary": message.content[:300],
            })
            current_question = None
    return compact[-4:]


def _graph_result_to_response(request_id: str, result: Any) -> ChatResponse:
    data = result if isinstance(result, dict) else result.__dict__
    query_result = data.get("query_result") or {}
    guardrails = data.get("guardrails_output") or {}
    error_code = _resolve_error_code(data)

    # Use formatted_table from analysis node if available, otherwise build from query_result
    formatted_table = data.get("formatted_table")
    if formatted_table:
        table = TableResponse(
            columns=formatted_table.get("columns") or [],
            rows=formatted_table.get("rows") or [],
            row_count=formatted_table.get("row_count") or 0,
            truncated=formatted_table.get("truncated", False),
        )
    elif query_result.get("columns") is not None and query_result.get("rows") is not None:
        table = TableResponse(
            columns=query_result.get("columns") or [],
            rows=query_result.get("rows") or [],
            row_count=query_result.get("rowCount") or 0,
        )
    else:
        table = None

    visualization = None
    raw_visualization = data.get("visualization")
    if raw_visualization:
        visualization = VisualizationResponse(
            type=raw_visualization.get("chart_type") or raw_visualization.get("type"),
            data=raw_visualization,
        )

    error = None
    if error_code:
        error = ErrorResponse(
            code=error_code,
            message=data.get("final_answer") or guardrails.get("answer") or "Request failed.",
        )

    return ChatResponse(
        request_id=request_id,
        answer=data.get("final_answer") or guardrails.get("answer") or guardrails.get("clarification_question"),
        language=data.get("language"),
        execution_steps=_normalize_steps(data.get("execution_steps") or []),
        table=table,
        visualization=visualization,
        technical=TechnicalResponse(
            generated_sql=data.get("sql_query"),
            sql_summary=data.get("sql_summary"),
            row_count=data.get("row_count") or query_result.get("rowCount") or 0,
            execution_ms=query_result.get("executionMs") or 0,
            retry_count=data.get("retry_count") or 0,
        ),
        error=error,
    )


def _normalize_steps(steps: list[dict[str, str]]) -> list[ExecutionStepResponse]:
    normalized: list[ExecutionStepResponse] = []
    include_debug = settings.app_env == "dev"
    for step in steps:
        name = str(step.get("name", "")).upper()
        status = str(step.get("status", "completed")).lower()
        if name not in ExecutionStepName._value2member_map_:
            continue
        if status not in ExecutionStepStatus._value2member_map_:
            status = ExecutionStepStatus.COMPLETED.value
        normalized.append(ExecutionStepResponse(
            name=ExecutionStepName(name),
            status=ExecutionStepStatus(status),
            message=step.get("message", ""),
            debug_message=step.get("debug_message") if include_debug else None,
        ))
    return normalized


def _resolve_error_code(data: dict[str, Any]) -> Optional[ErrorCode]:
    intent = data.get("intent")
    if intent == ErrorCode.OUT_OF_SCOPE.value:
        return ErrorCode.OUT_OF_SCOPE
    if intent == ErrorCode.PRIVACY_RISK.value:
        return ErrorCode.PRIVACY_RISK
    if intent == ErrorCode.AUTHORIZATION_RISK.value:
        return ErrorCode.AUTHORIZATION_RISK
    if intent == ErrorCode.PROMPT_INJECTION.value:
        return ErrorCode.PROMPT_INJECTION
    if intent == ErrorCode.DESTRUCTIVE_REQUEST.value:
        return ErrorCode.DESTRUCTIVE_REQUEST
    if intent == "AMBIGUOUS":
        return ErrorCode.AMBIGUOUS_QUESTION

    sql_error = data.get("sql_error")
    query_error = data.get("query_error")
    if sql_error == ErrorCode.SQL_SCOPE_VIOLATION.value:
        return ErrorCode.SQL_SCOPE_VIOLATION
    if sql_error:
        return ErrorCode.SQL_VALIDATION_FAILED
    if query_error == ErrorCode.QUERY_TIMEOUT.value:
        return ErrorCode.QUERY_TIMEOUT
    if query_error:
        return ErrorCode.SQL_EXECUTION_FAILED
    if data.get("final_answer") and any(
        step.get("name") == "FAILURE" for step in data.get("execution_steps", [])
    ):
        return ErrorCode.SQL_REPAIR_FAILED
    return None


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    setup_logging()
    logging.info(f"AI Service starting in {'MOCK' if settings.is_mock_mode else 'PRODUCTION'} mode")
    logging.info(f"Backend URL: {settings.backend_base_url}")
    logging.info(f"Mock Mode: {settings.is_mock_mode}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "dev",
    )
