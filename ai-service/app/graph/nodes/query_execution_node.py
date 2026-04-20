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
            execution_policy=state.access_mode or "PERSONAL",
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

        # Detect suspect zero-row results: aggregation queries with a WHERE filter
        # should almost never return 0 rows — likely a filter value mismatch.
        # Only trigger on the first attempt (iteration_count == 0) to avoid loops.
        if (
            response.row_count == 0
            and state.iteration_count == 0
            and _is_suspect_zero_rows(sql)
        ):
            log.warning(
                "Aggregation query returned 0 rows — suspect filter mismatch",
                step_name="QUERY_EXECUTION",
                step_status="failed",
            )
            execution_steps.append({
                "name": "QUERY_EXECUTION",
                "status": "completed",
                "message": "Returned 0 rows",
            })
            return {
                "query_result": result,
                "row_count": 0,
                "query_error": (
                    "ZERO_ROWS_SUSPECT: Query returned 0 rows. "
                    "Likely cause: WHERE clause uses wrong filter values "
                    "(e.g., wrong enum casing like 'MALE' instead of 'Male', or wrong date format). "
                    "Fix the filter values and retry."
                ),
                "last_error": "ZERO_ROWS_SUSPECT",
                "execution_steps": execution_steps,
            }

        execution_steps.append({
            "name": "QUERY_EXECUTION",
            "status": "completed",
            "message": f"Returned {response.row_count} rows",
        })
        return {
            "query_result": result,
            "row_count": response.row_count,
            "query_error": None,
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


def _is_suspect_zero_rows(sql: str) -> bool:
    """Return True if a zero-row result is likely a filter mismatch rather than legitimate empty data.

    Heuristic: GROUP BY aggregation queries that also have a WHERE clause
    almost never return 0 rows from a populated table. Zero rows in this
    case almost always means wrong enum casing or invalid filter values.
    """
    sql_lower = sql.lower()
    has_group_by = "group by" in sql_lower
    has_aggregate = any(
        f"{fn}(" in sql_lower for fn in ("count", "sum", "avg", "min", "max")
    )
    has_where = "where" in sql_lower
    return has_group_by and has_aggregate and has_where


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
