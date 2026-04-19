"""LangGraph Workflow Definition - Task 5."""

import logging
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from app.agents.guardrails_agent import IntentType, guardrails_node
from app.graph.nodes import (
    analysis_node,
    error_repair_node,
    query_execution_node,
    schema_context_node,
    sql_generation_node,
    sql_validation_node,
    visualization_node,
)
from app.graph.state import AgentState

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


def route_after_guardrails(state: AgentState) -> str:
    """Route based on guardrails intent classification."""
    if state.should_execute_sql:
        return "fetch_schema"
    if state.intent == IntentType.GREETING.value:
        return "greeting_final"
    if state.intent in {
        IntentType.OUT_OF_SCOPE.value,
        IntentType.PRIVACY_RISK.value,
        IntentType.AUTHORIZATION_RISK.value,
        IntentType.PROMPT_INJECTION.value,
        IntentType.DESTRUCTIVE_REQUEST.value,
    }:
        return "rejection_final"
    if state.intent == IntentType.AMBIGUOUS.value:
        return "clarification_final"
    return "fetch_schema"


def route_after_validation(state: AgentState) -> str:
    """Route after SQL validation."""
    if state.sql_query:
        return "query_execution"
    if state.iteration_count < MAX_RETRIES:
        return "error_repair"
    return "validation_failure"


def route_after_execution(state: AgentState) -> str:
    """Route after query execution."""
    if not state.query_error:
        return "analysis"
    if state.iteration_count < MAX_RETRIES:
        return "error_repair"
    return "execution_failure"


def route_after_error_repair(state: AgentState) -> str:
    """Route after error repair attempt."""
    if state.sql_query:
        return "sql_validation"
    return "repair_failure"


def create_workflow() -> StateGraph:
    """Create the LangGraph workflow for the analytics chatbot."""
    workflow = StateGraph(AgentState)

    workflow.add_node("guardrails", guardrails_node)
    workflow.add_node("fetch_schema", schema_context_node)
    workflow.add_node("sql_generation", sql_generation_node)
    workflow.add_node("sql_validation", sql_validation_node)
    workflow.add_node("query_execution", query_execution_node)
    workflow.add_node("error_repair", error_repair_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("generate_chart", visualization_node)

    workflow.add_node("greeting_final", lambda state: _terminal_response(state, "greeting"))
    workflow.add_node("rejection_final", lambda state: _terminal_response(state, "rejection"))
    workflow.add_node("clarification_final", lambda state: _terminal_response(state, "clarification"))
    workflow.add_node("validation_failure", lambda state: _failure_response(state, "SQL_VALIDATION_FAILED"))
    workflow.add_node("execution_failure", lambda state: _failure_response(state, "QUERY_TIMEOUT"))
    workflow.add_node("repair_failure", lambda state: _failure_response(state, "SQL_REPAIR_FAILED"))

    workflow.set_entry_point("guardrails")

    workflow.add_conditional_edges(
        "guardrails",
        route_after_guardrails,
        {
            "greeting_final": "greeting_final",
            "rejection_final": "rejection_final",
            "clarification_final": "clarification_final",
            "fetch_schema": "fetch_schema",
        },
    )
    workflow.add_edge("fetch_schema", "sql_generation")
    workflow.add_edge("sql_generation", "sql_validation")
    workflow.add_conditional_edges(
        "sql_validation",
        route_after_validation,
        {
            "query_execution": "query_execution",
            "error_repair": "error_repair",
            "validation_failure": "validation_failure",
        },
    )
    workflow.add_conditional_edges(
        "query_execution",
        route_after_execution,
        {
            "analysis": "analysis",
            "error_repair": "error_repair",
            "execution_failure": "execution_failure",
        },
    )
    workflow.add_conditional_edges(
        "error_repair",
        route_after_error_repair,
        {
            "sql_validation": "sql_validation",
            "repair_failure": "repair_failure",
        },
    )
    workflow.add_edge("analysis", "generate_chart")
    workflow.add_edge("generate_chart", END)

    workflow.add_edge("greeting_final", END)
    workflow.add_edge("rejection_final", END)
    workflow.add_edge("clarification_final", END)
    workflow.add_edge("validation_failure", END)
    workflow.add_edge("execution_failure", END)
    workflow.add_edge("repair_failure", END)

    return workflow


def _terminal_response(state: AgentState, response_type: str) -> Dict[str, Any]:
    """Generate terminal response for greeting/rejection/clarification."""
    from app.services.step_messages import complete_step

    guardrails = state.guardrails_output or {}

    if response_type == "greeting":
        answer = guardrails.get("answer", "Hello. I can help with e-commerce analytics.")
    elif response_type == "rejection":
        answer = guardrails.get("answer", "I cannot fulfill this request.")
    elif response_type == "clarification":
        answer = guardrails.get("clarification_question", "Could you clarify your question?")
    else:
        answer = "Unexpected condition."

    execution_steps = list(state.execution_steps)
    execution_steps.append(complete_step(
        name=response_type.upper(),
        user_message=f"Terminal response: {response_type}",
        debug_context=f"Response type: {response_type}",
    ))

    return {
        "final_answer": answer,
        "execution_steps": execution_steps,
    }


def _failure_response(state: AgentState, error_code: str) -> Dict[str, Any]:
    """Generate failure response."""
    from app.services.step_messages import complete_step

    error_messages = {
        "SQL_VALIDATION_FAILED": "Your query did not pass the security checks. Please try a different analytics question.",
        "QUERY_TIMEOUT": "The query took too long. Please try a shorter date range or a more specific question.",
        "SQL_REPAIR_FAILED": "I could not repair the generated query. Please rephrase your question.",
    }
    answer = error_messages.get(error_code, "An error occurred.")
    if state.last_error and state.retry_count > 0:
        answer = f"{answer} (retry count: {state.retry_count})"

    execution_steps = list(state.execution_steps)
    execution_steps.append(complete_step(
        name="FAILURE",
        user_message=f"Failed with {error_code}",
        debug_context=f"Error code: {error_code}, retry count: {state.retry_count}",
    ))

    return {
        "final_answer": answer,
        "execution_steps": execution_steps,
    }


_compiled_workflow = None


def compile_workflow():
    """Compile and cache the workflow graph."""
    global _compiled_workflow
    if _compiled_workflow is None:
        _compiled_workflow = create_workflow().compile()
    return _compiled_workflow


def get_workflow():
    """Backward-compatible accessor for an uncompiled workflow."""
    return create_workflow()
