"""Query Execution Node - Task 5.2"""

import logging
from datetime import date, datetime, timedelta
from typing import Dict, Any

from app.graph.state import AgentState
from app.schemas.query_executor import (
    QueryExecutorRequest,
    QueryParameters,
    UserContext,
    RoleType,
)
from app.services.ai_client import ai_client
from app.logging_config import get_ai_logger, sanitize_sql

logger = logging.getLogger(__name__)


async def query_execution_node(state: AgentState) -> Dict[str, Any]:
    """
    Execute SQL query via backend internal endpoint.

    Input:
        state.sql_query: Validated SQL with placeholders
        state.user_id: Current user ID
        state.user_role: Role for audit logging
        state.allowed_store_ids: For CORPORATE users
        state.selected_store_id: If user selected specific store
        state.question: Original question (for audit)

    Output:
        state.query_result: Query result from backend
        state.row_count: Number of rows returned
        OR
        state.query_error: Sanitized error message
        state.last_error: Error details
        state.execution_steps: Updated with QUERY_EXECUTION step
    """
    log = get_ai_logger(
        __name__,
        request_id=state.request_id,
        user_id=state.user_id,
        user_role=state.user_role,
    )

    sql = state.sql_query

    if not sql:
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "QUERY_EXECUTION",
            "status": "failed",
            "message": "No SQL to execute",
        })
        return {
            "query_error": "NO_SQL",
            "last_error": "Query execution called without SQL",
            "execution_steps": execution_steps,
        }

    log.info("Starting query execution", sql_query=sql)

    execution_steps = list(state.execution_steps)

    try:
        request = QueryExecutorRequest(
            request_id=state.request_id or state.user_id,
            sql=sql,
            parameters=QueryParameters(
                current_user_id=state.user_id,
                allowed_store_ids=state.allowed_store_ids,
                selected_store_id=state.selected_store_id,
                start_date=_default_start_date(state.current_date),
                end_date=_default_end_date(state.current_date),
                limit=100,
            ),
            user_context=UserContext(
                user_id=state.user_id,
                email=state.user_email,
                role=RoleType(state.user_role),
            ),
        )
        response = await ai_client.execute_query(request)

        if response.error:
            log.warning(
                "Query execution returned error",
                error_code=response.error,
                step_name="QUERY_EXECUTION",
                step_status="failed",
            )
            execution_steps.append({
                "name": "QUERY_EXECUTION",
                "status": "failed",
                "message": f"Backend error: {response.error[:80]}",
            })
            return {
                "query_error": response.error,
                "last_error": response.error,
                "execution_steps": execution_steps,
            }

        result = {
            "requestId": response.request_id,
            "columns": response.columns or [],
            "rows": response.rows or [],
            "rowCount": response.row_count,
            "executionMs": response.execution_ms,
            "data": _rows_to_dicts(response.columns or [], response.rows or []),
        }

        log.info(
            "Query execution completed",
            row_count=response.row_count,
            execution_ms=response.execution_ms,
            step_name="QUERY_EXECUTION",
            step_status="completed",
        )

        execution_steps.append({
            "name": "QUERY_EXECUTION",
            "status": "completed",
            "message": f"Returned {response.row_count} rows",
        })
        return {
            "query_result": result,
            "row_count": response.row_count,
            "execution_steps": execution_steps,
        }

    except Exception as e:
        log.error(
            "Query execution failed",
            error_code="EXECUTION_FAILED",
            step_name="QUERY_EXECUTION",
            step_status="failed",
        )
        execution_steps.append({
            "name": "QUERY_EXECUTION",
            "status": "failed",
            "message": f"Error: {str(e)[:50]}",
        })
        return {
            "query_error": "EXECUTION_FAILED",
            "last_error": str(e),
            "execution_steps": execution_steps,
        }


def _rows_to_dicts(columns: list[str], rows: list[list]) -> list[dict]:
    return [dict(zip(columns, row)) for row in rows]


def _parse_current_date(current_date: str) -> date:
    if current_date:
        try:
            return datetime.strptime(current_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    return date.today()


def _default_start_date(current_date: str) -> date:
    return _parse_current_date(current_date) - timedelta(days=30)


def _default_end_date(current_date: str) -> date:
    # Use an exclusive-friendly upper bound for timestamp columns when SQL uses BETWEEN.
    return _parse_current_date(current_date) + timedelta(days=1)
