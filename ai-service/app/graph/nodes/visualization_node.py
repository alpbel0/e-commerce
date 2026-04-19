"""Visualization Node - Task 5.2"""

import logging
from typing import Dict, Any

from app.graph.state import AgentState
from app.agents.visualization_agent import visualization_agent
from app.logging_config import get_ai_logger

logger = logging.getLogger(__name__)


def visualization_node(state: AgentState) -> Dict[str, Any]:
    """
    Generate Plotly-compatible chart specification if appropriate.

    Input:
        state.query_result: Query data for charting
        state.chart_hint: Suggested chart type from SQL generation
        state.sql_summary: SQL summary for pattern detection
        state.final_answer: Current text answer (may be updated)
        state.language: Response language for localized labels

    Output:
        state.visualization: Plotly chart spec or None
        state.final_answer: Updated answer with chart reference
        state.execution_steps: Updated with VISUALIZATION step
    """
    log = get_ai_logger(
        __name__,
        request_id=state.request_id,
        user_id=state.user_id,
        user_role=state.user_role,
        language=state.language,
    )

    log.info("Starting visualization", chart_hint=state.chart_hint)

    try:
        result = visualization_agent.create_visualization(
            query_result=state.query_result,
            chart_hint=state.chart_hint,
            language=state.language,
            sql_summary=state.sql_summary,
        )

        chart_type = result.get("chart_type")
        visualization = result.get("visualization")
        reason = result.get("reason")

        execution_steps = list(state.execution_steps)

        if chart_type and visualization:
            log.info(
                "Visualization completed",
                chart_type=chart_type,
                step_name="VISUALIZATION",
                step_status="completed",
            )
            execution_steps.append({
                "name": "VISUALIZATION",
                "status": "completed",
                "message": f"Generated {chart_type} chart",
            })
            updated_answer = state.final_answer
        else:
            log.info(
                "Visualization skipped",
                step_name="VISUALIZATION",
                step_status="skipped",
            )
            execution_steps.append({
                "name": "VISUALIZATION",
                "status": "skipped",
                "message": reason or "No chart needed",
            })
            updated_answer = state.final_answer

        return {
            "visualization": visualization,
            "final_answer": updated_answer,
            "execution_steps": execution_steps,
        }

    except Exception as e:
        log.error(
            "Visualization failed",
            error_code="VISUALIZATION_FAILED",
            step_name="VISUALIZATION",
            step_status="failed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "VISUALIZATION",
            "status": "failed",
            "message": f"Visualization error: {str(e)[:50]}",
        })
        return {
            "visualization": None,
            "execution_steps": execution_steps,
        }
