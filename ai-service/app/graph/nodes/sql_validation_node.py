"""SQL Validation Node - Task 5.2"""

import logging
from typing import Dict, Any, Optional

from app.graph.state import AgentState
from app.services.sql_validator import sql_validator, ValidationResult
from app.logging_config import get_ai_logger

logger = logging.getLogger(__name__)


def sql_validation_node(state: AgentState) -> Dict[str, Any]:
    """
    Validate SQL query against security rules (deterministic).

    Input:
        state.sql_query: SQL query string to validate
        state.user_role: Role for scope enforcement

    Output:
        state.sql_query: Cleaned/validated SQL (None if rejected)
        state.execution_steps: Updated with SQL_VALIDATION step
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
            "name": "SQL_VALIDATION",
            "status": "failed",
            "message": "No SQL query to validate",
        })
        return {
            "sql_query": None,
            "execution_steps": execution_steps,
        }

    log.info("Starting SQL validation")

    result: ValidationResult = sql_validator.validate(
        sql=sql,
        role=state.user_role,
        access_mode=state.access_mode,
        require_scope_filter=True
    )

    execution_steps = list(state.execution_steps)

    if result.is_valid:
        clean_sql = sql_validator.get_safe_sql(sql)
        log.info(
            "SQL validation passed",
            step_name="SQL_VALIDATION",
            step_status="completed",
        )
        execution_steps.append({
            "name": "SQL_VALIDATION",
            "status": "completed",
            "message": "SQL valid" + (f" (applied {result.applied_defaults})" if result.applied_defaults else ""),
        })
        return {
            "sql_query": clean_sql,
            "execution_steps": execution_steps,
        }
    else:
        log.warning(
            "SQL validation failed",
            error_code=result.error_code,
            step_name="SQL_VALIDATION",
            step_status="failed",
        )
        execution_steps.append({
            "name": "SQL_VALIDATION",
            "status": "failed",
            "message": f"Rejected: {result.error_message}",
        })
        return {
            "sql_query": None,
            "sql_error": result.error_code,
            "sql_error_message": result.error_message,
            "sql_error_details": result.error_details or {},
            "execution_steps": execution_steps,
        }
