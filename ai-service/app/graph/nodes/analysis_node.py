"""Analysis Node - Task 5.2"""

import logging
from typing import Dict, Any

from app.config import settings
from app.graph.state import AgentState
from app.agents.analysis_agent import analysis_agent
from app.logging_config import get_ai_logger

logger = logging.getLogger(__name__)


def analysis_node(state: AgentState) -> Dict[str, Any]:
    """
    Analyze query results and generate natural language explanation.

    Input:
        state.query_result: Raw query data from execution
        state.language: Response language (tr/en)
        state.chart_hint: Hint for whether visualization is needed
        state.sql_summary: Summary of what the SQL did
        state.row_count: Number of rows returned
        state.date_range_applied: True if default date range was used
        state.limit_applied: True if row limit was applied
        state.column_metadata: Column metadata for table formatting

    Output:
        state.final_answer: Natural language explanation
        state.formatted_table: Frontend-friendly table response
        state.execution_steps: Updated with ANALYSIS step
    """
    log = get_ai_logger(
        __name__,
        request_id=state.request_id,
        user_id=state.user_id,
        user_role=state.user_role,
        language=state.language,
    )

    log.info("Starting analysis", row_count=state.row_count)

    try:
        from app.services.table_formatter import format_table_response

        result = analysis_agent.analyze(
            query_result=state.query_result,
            language=state.language,
            chart_hint=state.chart_hint,
            sql_summary=state.sql_summary,
            row_count=state.row_count,
            date_range_applied=state.date_range_applied,
            limit_applied=state.limit_applied,
        )

        # Format table for frontend using column metadata from schema
        formatted_table = format_table_response(
            query_result=state.query_result,
            column_metadata=state.column_metadata,
            language=state.language,
            sql_max_rows=settings.sql_max_rows,
        )

        log.info(
            "Analysis completed",
            row_count=state.row_count,
            step_name="ANALYSIS",
            step_status="completed",
        )

        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "ANALYSIS",
            "status": "completed",
            "message": f"Analyzed {state.row_count or 0} rows",
        })

        return {
            "final_answer": result.get("answer"),
            "formatted_table": {
                "columns": formatted_table.columns,
                "rows": formatted_table.rows,
                "row_count": formatted_table.row_count,
                "truncated": formatted_table.truncated,
            },
            "execution_steps": execution_steps,
        }

    except Exception as e:
        log.error(
            "Analysis failed",
            error_code="ANALYSIS_FAILED",
            step_name="ANALYSIS",
            step_status="failed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "ANALYSIS",
            "status": "failed",
            "message": f"Analysis error: {str(e)[:50]}",
        })
        return {
            "final_answer": f"Analysis failed: {str(e)[:100]}",
            "execution_steps": execution_steps,
        }
