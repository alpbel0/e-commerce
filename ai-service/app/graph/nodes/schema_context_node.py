"""Schema Context Node - Task 5.2"""

import logging
from typing import Dict, Any

from app.graph.state import AgentState
from app.services.schema_provider import schema_provider
from app.logging_config import get_ai_logger

logger = logging.getLogger(__name__)


async def schema_context_node(state: AgentState) -> Dict[str, Any]:
    """
    Fetch and inject schema context into the graph state.

    Input:
        state.user_role: Role for determining accessible tables
        state.allowed_store_ids: List of store IDs the user can access (CORPORATE)

    Output:
        state.schema_context: Dict with tables, columns, relationships
        state.column_metadata: Flat list of {name, dataType, isPII, tableName} for table formatter
        state.execution_steps: Updated with SCHEMA_CONTEXT step
    """
    log = get_ai_logger(
        __name__,
        request_id=state.request_id,
        user_id=state.user_id,
        user_role=state.user_role,
    )

    log.info("Fetching schema context")

    try:
        schema = await schema_provider.get_schema_async()

        # Extract column metadata for table formatter (flatten all table columns)
        column_metadata = _extract_column_metadata(schema)

        # Build execution step
        table_count = len(schema.get("tables", []))
        schema_tables = [t.get("tableName") for t in schema.get("tables", [])]

        log.info(
            "Schema context loaded",
            schema_tables=schema_tables,
            step_name="SCHEMA_CONTEXT",
            step_status="completed",
        )

        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "SCHEMA_CONTEXT",
            "status": "completed",
            "message": f"Loaded {table_count} tables from schema",
        })

        return {
            "schema_context": schema,
            "column_metadata": column_metadata,
            "execution_steps": execution_steps,
        }
    except Exception as e:
        log.error(
            "Failed to load schema context",
            error_code="SCHEMA_UNAVAILABLE",
            step_name="SCHEMA_CONTEXT",
            step_status="failed",
        )
        execution_steps = list(state.execution_steps)
        execution_steps.append({
            "name": "SCHEMA_CONTEXT",
            "status": "failed",
            "message": f"Schema unavailable: {str(e)[:100]}",
        })
        return {
            "schema_context": {},
            "column_metadata": [],
            "execution_steps": execution_steps,
        }


def _extract_column_metadata(schema: dict) -> list[dict]:
    """
    Extract flat column metadata from schema for table formatter.

    Returns:
        List of {name, dataType, isPII, tableName} for every column
        in every accessible table.
    """
    metadata = []
    pii_columns = set(schema.get("roleRules", {}).get("piiColumns", []))
    sensitive_columns = set(schema.get("roleRules", {}).get("sensitiveColumns", []))

    for table in schema.get("tables", []):
        table_name = table.get("tableName", "")
        for col in table.get("columns", []):
            col_name = col.get("name", "")
            is_pii = (
                col.get("isPII", False)
                or col_name.lower() in pii_columns
                or col_name.lower() in sensitive_columns
            )
            metadata.append({
                "name": col_name,
                "dataType": col.get("dataType", "VARCHAR"),
                "isPII": is_pii,
                "tableName": table_name,
            })

    return metadata
