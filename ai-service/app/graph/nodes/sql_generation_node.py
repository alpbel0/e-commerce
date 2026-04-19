"""SQL Generation Node - Task 5.2"""

import logging
from typing import Dict, Any

from app.graph.state import AgentState
from app.agents.sql_generation_agent import sql_generation_agent
from app.logging_config import get_ai_logger

logger = logging.getLogger(__name__)


def sql_generation_node(state: AgentState) -> Dict[str, Any]:
    """
    Generate SQL from natural language question using schema context.

    Input:
        state.question: User's question
        state.schema_context: Available tables and columns
        state.user_role: Role for scope rules
        state.allowed_store_ids: For CORPORATE scope
        state.selected_store_id: For specific store queries
        state.conversation_memory: Previous Q&A for context
        state.current_date: Today's date for date calculations
        state.language: Response language hint

    Output:
        state.sql_query: Generated SQL with named placeholders
        state.sql_summary: Human-readable summary
        state.chart_hint: Suggested chart type or None
        state.execution_steps: Updated with SQL_GENERATION step
    """
    # Create structured logger with context
    log = get_ai_logger(
        __name__,
        request_id=state.request_id,
        user_id=state.user_id,
        user_role=state.user_role,
        intent=state.intent,
        language=state.language,
    )

    log.info("Starting SQL generation")

    try:
        result = sql_generation_agent.generate(
            question=state.question,
            schema_context=state.schema_context,
            user_role=state.user_role,
            allowed_store_ids=state.allowed_store_ids,
            selected_store_id=state.selected_store_id,
            conversation_memory=state.conversation_memory,
            current_date=state.current_date,
            language=state.language,
        )

        log.info(
            "SQL generation completed",
            sql_summary=result.get("summary"),
            chart_hint=result.get("chart_hint"),
            step_name="SQL_GENERATION",
            step_status="completed",
        )

        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "SQL_GENERATION",
            "status": "completed",
            "message": f"Generated: {result.get('summary', 'SQL query')[:50]}",
        })

        return {
            "sql_query": result.get("sql"),
            "sql_summary": result.get("summary"),
            "chart_hint": result.get("chart_hint"),
            "date_range_applied": result.get("date_range_applied", False),
            "limit_applied": result.get("limit_applied", False),
            "execution_steps": execution_steps,
        }

    except Exception as e:
        log.error(
            "SQL generation failed",
            error_code="SQL_GENERATION_FAILED",
            step_name="SQL_GENERATION",
            step_status="failed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "SQL_GENERATION",
            "status": "failed",
            "message": f"Generation error: {str(e)[:50]}",
        })
        return {
            "sql_query": None,
            "sql_error": "SQL_GENERATION_FAILED",
            "sql_error_message": str(e),
            "execution_steps": execution_steps,
        }
