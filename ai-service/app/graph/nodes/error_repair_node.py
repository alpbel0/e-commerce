"""Error Repair Node - Task 5.2"""

import logging
from typing import Dict, Any

from app.graph.state import AgentState
from app.agents.error_repair_agent import error_repair_agent
from app.logging_config import get_ai_logger

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


def error_repair_node(state: AgentState) -> Dict[str, Any]:
    """
    Attempt to repair a failed SQL query.

    Input:
        state.sql_query: Original/previous SQL
        state.query_error: Error message from execution
        state.schema_context: Schema for reference
        state.iteration_count: Current retry count
        state.conversation_memory: For context
        state.last_error: Previous error for repetition detection
        state.previous_sql: SQL from previous repair attempt

    Output:
        state.sql_query: Repaired SQL
        state.iteration_count: Incremented
        state.execution_steps: Updated with ERROR_REPAIR step
        state.last_error: Current error (for next iteration)
        state.previous_sql: This SQL (for next iteration repetition check)
    """
    log = get_ai_logger(
        __name__,
        request_id=state.request_id,
        user_id=state.user_id,
        user_role=state.user_role,
    )

    current_iteration = state.iteration_count

    if current_iteration >= MAX_RETRIES:
        log.warning(
            "Max retries reached for error repair",
            retry_count=current_iteration,
            step_name="ERROR_REPAIR",
            step_status="failed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "ERROR_REPAIR",
            "status": "failed",
            "message": "Max retries reached",
        })
        return {
            "sql_query": None,
            "query_error": "MAX_RETRIES_EXCEEDED",
            "execution_steps": execution_steps,
        }

    previous_sql = state.sql_query
    current_error = state.query_error or state.last_error or ""

    log.info(
        f"Starting error repair attempt {current_iteration + 1}",
        error_code=current_error[:100] if current_error else None,
        step_name="ERROR_REPAIR",
        step_status="running",
    )

    try:
        result = error_repair_agent.repair(
            original_sql=state.sql_query or "",
            error_message=current_error,
            error_details=state.sql_error_details,
            schema_context=state.schema_context,
            question=state.question,
            conversation_memory=state.conversation_memory,
            user_role=state.user_role,
            allowed_store_ids=state.allowed_store_ids,
            selected_store_id=state.selected_store_id,
        )

        proposed_sql = result.get("sql", "")

        if previous_sql and proposed_sql == previous_sql:
            log.warning(
                "Repetition detected in error repair",
                step_name="ERROR_REPAIR",
                step_status="failed",
            )
            execution_steps = list(state.execution_steps)
            execution_steps.append({
                "name": "ERROR_REPAIR",
                "status": "failed",
                "message": "Repetition detected: AI is stuck in a loop, stopping.",
            })
            return {
                "sql_query": None,
                "query_error": "REPETITION_DETECTED",
                "previous_sql": previous_sql,
                "execution_steps": execution_steps,
            }

        new_iteration = current_iteration + 1
        log.info(
            f"Error repair attempt {new_iteration} completed",
            retry_count=new_iteration,
            step_name="ERROR_REPAIR",
            step_status="completed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "ERROR_REPAIR",
            "status": "completed",
            "message": f"Repair attempt {new_iteration}: {result.get('action', 'modified')}",
        })

        return {
            "sql_query": proposed_sql,
            "iteration_count": new_iteration,
            "retry_count": new_iteration,
            "last_error": current_error,
            "previous_sql": previous_sql,
            "execution_steps": execution_steps,
        }

    except Exception as e:
        log.error(
            "Error repair failed",
            error_code="REPAIR_ERROR",
            step_name="ERROR_REPAIR",
            step_status="failed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "ERROR_REPAIR",
            "status": "failed",
            "message": f"Repair error: {str(e)[:50]}",
        })
        return {
            "sql_query": None,
            "query_error": "REPAIR_ERROR",
            "previous_sql": previous_sql,
            "execution_steps": execution_steps,
        }
