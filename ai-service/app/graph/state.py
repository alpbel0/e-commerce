"""LangGraph Agent State - Task 5.1"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class AgentState:
    """
    LangGraph state for the e-commerce analytics chatbot.

    This state is passed between all nodes in the graph and accumulates
    execution context as it flows through the pipeline.

    State Invariants:
    - No raw PII, password, email, token stored in any field
    - conversation_memory is compact (summaries, not raw messages)
    - execution_steps accumulate (each node appends, never overwrites)
    - iteration_count max 2 (original + 2 retries)
    """

    # === INPUT ===
    request_id: str = ""                            # Request correlation ID
    question: str = ""                              # User's natural language question
    current_date: str = ""                          # Today's date YYYY-MM-DD

    # === USER CONTEXT (from JWT/backend) ===
    user_id: str = ""
    user_email: str = ""
    user_role: str = "INDIVIDUAL"                   # ADMIN | CORPORATE | INDIVIDUAL
    allowed_store_ids: List[str] = field(default_factory=list)   # For CORPORATE users
    selected_store_id: Optional[str] = None         # If user named a specific store

    # === CONVERSATION MEMORY (compact - last 4 pairs) ===
    conversation_memory: List[Dict[str, Any]] = field(default_factory=list)

    # === SCHEMA CONTEXT ===
    schema_context: Dict[str, Any] = field(default_factory=dict)
    column_metadata: List[Dict[str, Any]] = field(default_factory=list)  # [{name, dataType, isPII, tableName}, ...]

    # === GUARDRAILS OUTPUT ===
    intent: str = "UNKNOWN"                         # GREETING | IN_SCOPE_ANALYTICS |
                                                     # OUT_OF_SCOPE | PRIVACY_RISK |
                                                     # AUTHORIZATION_RISK |
                                                     # PROMPT_INJECTION |
                                                     # DESTRUCTIVE_REQUEST | AMBIGUOUS
    language: str = "en"                            # "tr" | "en"
    should_execute_sql: bool = False
    guardrails_output: Dict[str, Any] = field(default_factory=dict)

    # === SQL PIPELINE ===
    sql_query: Optional[str] = None                 # Generated SQL with placeholders
    sql_summary: Optional[str] = None               # Human-readable SQL summary
    chart_hint: Optional[str] = None                # "bar" | "line" | "pie" | None
    sql_error: Optional[str] = None
    sql_error_message: Optional[str] = None
    sql_error_details: Dict[str, Any] = field(default_factory=dict)

    # === QUERY EXECUTION ===
    query_result: Optional[Dict[str, Any]] = None
    query_error: Optional[str] = None              # Sanitized error message
    row_count: Optional[int] = None

    # === ERROR REPAIR ===
    iteration_count: int = 0                        # Max 2 (original + 2 retries)
    last_error: Optional[str] = None
    previous_sql: Optional[str] = None               # SQL from previous repair attempt (for repetition detection)

    # === OUTPUT ===
    final_answer: Optional[str] = None
    visualization: Optional[Dict[str, Any]] = None  # Plotly-compatible chart spec
    formatted_table: Optional[Dict[str, Any]] = None # Frontend-friendly table response

    # === EXECUTION TRACKING ===
    execution_steps: List[Dict[str, str]] = field(default_factory=list)
    retry_count: int = 0                           # Number of repair attempts made

    # === CONTEXT FLAGS (set by SQL generation, read by analysis) ===
    date_range_applied: bool = False                # User didn't specify date range, default used
    limit_applied: bool = False                     # Row limit was truncated


# Type alias for convenience
GraphState = AgentState
