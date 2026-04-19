"""Tests for Error Repair Node - Task 5.4"""

import pytest
from unittest.mock import patch, MagicMock

from app.graph.state import AgentState
from app.graph.nodes.error_repair_node import (
    error_repair_node,
    MAX_RETRIES,
)


class TestErrorRepairNodeMaxRetries:
    """Test MAX_RETRIES enforcement."""

    def test_max_retries_exceeded_returns_failure(self):
        """When iteration_count >= MAX_RETRIES, should return failure."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FROM bad_syntax",
            query_error="Syntax error",
            iteration_count=MAX_RETRIES,  # Already at max
        )

        result = error_repair_node(state)

        assert result["sql_query"] is None
        assert result["query_error"] == "MAX_RETRIES_EXCEEDED"
        assert result["execution_steps"][-1]["message"] == "Max retries reached"

    def test_max_retries_one_left_allows_retry(self):
        """When iteration_count < MAX_RETRIES, should attempt repair."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FORM orders",
            query_error="Syntax error",
            last_error="Different error",
            iteration_count=MAX_RETRIES - 1,  # One retry left
            schema_context={"tables": []},
            conversation_memory=[],
            previous_sql=None,
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",
                "action": "fixed syntax",
                "still_failing": False,
            }
            result = error_repair_node(state)

        assert result["sql_query"] == "SELECT * FROM orders"
        assert result["iteration_count"] == MAX_RETRIES


class TestErrorRepairNodeRepetitionDetection:
    """Test repetition detection in error repair node."""

    def test_repeated_sql_stops_retry_loop(self):
        """Repair agent proposing same SQL twice should stop retry."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FROM orders",  # Original SQL
            query_error="Syntax error",
            iteration_count=1,
            schema_context={},
            conversation_memory=[],
            previous_sql="SELECT * FROM orders",  # Same SQL was proposed before
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            # Repair agent returns the SAME SQL
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",  # Same as previous_sql
                "action": "no change needed",
                "still_failing": False,
            }

            result = error_repair_node(state)

        assert result["sql_query"] is None
        assert result["query_error"] == "REPETITION_DETECTED"
        assert "loop" in result["execution_steps"][-1]["message"].lower()

    def test_different_sql_allows_retry(self):
        """Repair agent proposing different SQL should continue."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FORM orders",  # Original with typo
            query_error="Syntax error",
            iteration_count=0,
            schema_context={"tables": {"orders": {"columns": []}}},
            conversation_memory=[],
            previous_sql=None,
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",  # Different SQL
                "action": "fixed typo",
                "still_failing": False,
            }

            result = error_repair_node(state)

        assert result["sql_query"] == "SELECT * FROM orders"
        assert result["iteration_count"] == 1
        # query_error key may not be present on success

    def test_repetition_adds_correct_execution_step(self):
        """Repetition should add specific message to execution_steps."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FROM orders",
            query_error="Syntax error",
            iteration_count=1,
            schema_context={},
            conversation_memory=[],
            previous_sql="SELECT * FROM orders",
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",  # Same SQL
                "action": "no change",
                "still_failing": False,
            }

            result = error_repair_node(state)

        last_step = result["execution_steps"][-1]
        assert last_step["name"] == "ERROR_REPAIR"
        assert last_step["status"] == "failed"
        assert "Repetition detected" in last_step["message"]

    def test_previous_sql_is_preserved_in_result(self):
        """Result should include previous_sql for next iteration."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FORM orders",
            query_error="Syntax error",
            iteration_count=0,
            schema_context={"tables": {"orders": {"columns": []}}},
            conversation_memory=[],
            previous_sql=None,
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",
                "action": "fixed",
                "still_failing": False,
            }

            result = error_repair_node(state)

        # previous_sql in result should be the SQL before this repair attempt
        assert result["previous_sql"] == "SELECT * FORM orders"


class TestErrorRepairNodeSuccess:
    """Test successful error repair flow."""

    def test_successful_repair_returns_new_sql(self):
        """Successful repair should return corrected SQL."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FORM orders",  # typo: FORM instead of FROM
            query_error="Unknown column 'FORM'",
            last_error=None,
            iteration_count=0,
            schema_context={
                "tables": {
                    "orders": {
                        "columns": ["id", "created_at", "store_id"]
                    }
                }
            },
            conversation_memory=[],
            previous_sql=None,
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",
                "action": "fixed typo: FORM -> FROM",
                "still_failing": False,
            }

            result = error_repair_node(state)

        assert result["sql_query"] == "SELECT * FROM orders"
        assert result["retry_count"] == 1
        assert result["iteration_count"] == 1
        assert "fixed typo" in result["execution_steps"][-1]["message"]

    def test_repair_preserves_error_for_next_iteration(self):
        """Repair should preserve error in last_error for next iteration comparison."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FORM orders",
            query_error="Unknown column 'FORM'",
            last_error=None,
            iteration_count=0,
            schema_context={},
            conversation_memory=[],
            previous_sql=None,
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",
                "action": "fixed",
                "still_failing": False,
            }

            result = error_repair_node(state)

        # last_error should be preserved for next iteration's repetition check
        assert result["last_error"] == "Unknown column 'FORM'"
        assert result["previous_sql"] == "SELECT * FORM orders"


class TestErrorRepairNodeException:
    """Test error repair exception handling."""

    def test_agent_exception_returns_failure(self):
        """Exception from repair agent should return failure."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FROM orders",
            query_error="Some error",
            last_error=None,
            iteration_count=0,
            schema_context={},
            conversation_memory=[],
            previous_sql=None,
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.side_effect = Exception("API Error")

            result = error_repair_node(state)

        assert result["sql_query"] is None
        assert result["query_error"] == "REPAIR_ERROR"
        assert "API Error" in result["execution_steps"][-1]["message"]


class TestMaxRetriesConstant:
    """Verify MAX_RETRIES is set correctly."""

    def test_max_retries_is_2(self):
        """MAX_RETRIES should be 2 (original + 2 retries)."""
        assert MAX_RETRIES == 2


class TestErrorRepairNodeStateFields:
    """Test that node properly handles state fields."""

    def test_state_without_previous_sql_allows_first_retry(self):
        """First repair attempt (no previous_sql) should work."""
        state = AgentState(
            question="Show me my sales",
            sql_query="SELECT * FORM orders",
            query_error="Syntax error",
            iteration_count=0,
            schema_context={"tables": {"orders": {"columns": []}}},
            conversation_memory=[],
            previous_sql=None,  # First attempt
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",
                "action": "fixed",
                "still_failing": False,
            }

            result = error_repair_node(state)

        # Should succeed since this is the first attempt
        assert result["sql_query"] == "SELECT * FROM orders"
        # query_error key may not be present on success

    def test_state_with_empty_sql_query_handled(self):
        """Empty sql_query should be handled gracefully."""
        state = AgentState(
            question="Show me my sales",
            sql_query=None,  # No SQL yet
            query_error="No SQL to execute",
            iteration_count=0,
            schema_context={},
            conversation_memory=[],
            previous_sql=None,
            execution_steps=[],
        )

        with patch("app.graph.nodes.error_repair_node.error_repair_agent") as mock_agent:
            mock_agent.repair.return_value = {
                "sql": "SELECT * FROM orders",
                "action": "generated new query",
                "still_failing": False,
            }

            result = error_repair_node(state)

        # Should still work, repair agent receives empty string
        assert result["sql_query"] == "SELECT * FROM orders"
        assert result["iteration_count"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
