"""SQL Generation Agent - Task 5.2 (stub)"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class SQLGenerationAgent:
    """
    LLM-powered agent that converts natural language questions to SQL.

    Generates SELECT queries with named placeholders following
    the role-based access control rules.
    """

    def __init__(self):
        base_dir = Path(__file__).parent.parent
        self._system_prompt_path = base_dir / "prompts" / "sql_generation_system.txt"
        self._user_prompt_path = base_dir / "prompts" / "sql_generation_user.txt"
        self._system_prompt: Optional[str] = None
        self._user_prompt_template: Optional[str] = None

    def generate(
        self,
        question: str,
        schema_context: Dict[str, Any],
        user_role: str,
        allowed_store_ids: List[int],
        selected_store_id: Optional[int],
        conversation_memory: List[Dict[str, Any]],
        current_date: str,
        language: str = "en",
    ) -> Dict[str, Any]:
        """
        Generate SQL query from question.

        Returns:
            {
                "sql": "SELECT ... FROM ... WHERE ...",
                "summary": "Human-readable summary",
                "chart_hint": "bar" | "line" | "pie" | None
            }
        """
        # Fast path: check if mock mode
        if settings.is_mock_mode:
            return self._mock_generate(question, user_role)

        # Load prompts
        system_prompt = self._load_system_prompt()
        user_prompt = self._build_user_prompt(
            question=question,
            schema_context=schema_context,
            user_role=user_role,
            allowed_store_ids=allowed_store_ids,
            selected_store_id=selected_store_id,
            conversation_memory=conversation_memory,
            current_date=current_date,
            language=language,
        )

        model = settings.get_model_for_agent("sql") or "openai/gpt-5.4-mini"

        try:
            response = self._call_llm(model, system_prompt, user_prompt)
            return self._parse_response(response)
        except Exception as e:
            logger.error(f"SQL generation failed: {e}")
            raise

    def _mock_generate(self, question: str, user_role: str) -> Dict[str, Any]:
        """Return a mock SQL for development testing."""
        if user_role == "CORPORATE":
            mock_sql = "SELECT id, grand_total FROM orders WHERE store_id IN (:allowedStoreIds) LIMIT :limit"
        elif user_role == "INDIVIDUAL":
            mock_sql = "SELECT id, grand_total FROM orders WHERE user_id = :currentUserId LIMIT :limit"
        else:
            mock_sql = "SELECT id, grand_total FROM orders LIMIT :limit"
        return {
            "sql": mock_sql,
            "summary": "Mock SQL: returning order totals",
            "chart_hint": None,
            "date_range_applied": False,
            "limit_applied": False,
        }

    def _load_system_prompt(self) -> str:
        if self._system_prompt is None:
            try:
                self._system_prompt = self._system_prompt_path.read_text(encoding="utf-8")
            except FileNotFoundError:
                self._system_prompt = self._get_default_system_prompt()
        return self._system_prompt

    def _load_user_prompt_template(self) -> str:
        if self._user_prompt_template is None:
            try:
                self._user_prompt_template = self._user_prompt_path.read_text(encoding="utf-8")
            except FileNotFoundError:
                self._user_prompt_template = self._get_default_user_prompt()
        return self._user_prompt_template

    def _build_user_prompt(
        self,
        question: str,
        schema_context: Dict[str, Any],
        user_role: str,
        allowed_store_ids: List[int],
        selected_store_id: Optional[int],
        conversation_memory: List[Dict[str, Any]],
        current_date: str,
        language: str,
    ) -> str:
        template = self._load_user_prompt_template()

        # Format schema context
        schema_json = json.dumps(schema_context, indent=2, ensure_ascii=False)

        # Format conversation memory
        memory_text = ""
        if conversation_memory:
            memory_lines = []
            for pair in conversation_memory[-4:]:  # Last 4 pairs
                memory_lines.append(f"User: {pair.get('question', '')}")
                memory_lines.append(f"Assistant: {pair.get('answer_summary', '')}")
            memory_text = "\n".join(memory_lines)

        # Format store info for CORPORATE
        store_info = ""
        if user_role == "CORPORATE":
            store_ids_str = ", ".join(map(str, allowed_store_ids))
            store_info = f"Allowed Store IDs: {store_ids_str}"
            if selected_store_id:
                store_info += f"\nSelected Store ID: {selected_store_id}"

        return template.format(
            question=question,
            schema_context=schema_json,
            user_role=user_role,
            store_info=store_info,
            conversation_memory=memory_text,
            current_date=current_date,
            language=language,
            memory_text=memory_text,
        )

    def _call_llm(self, model: str, system_prompt: str, user_prompt: str) -> str:
        if not settings.openrouter_api_key:
            raise ValueError("OpenRouter API key not configured")

        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response into structured SQL output."""
        try:
            # Try to extract JSON from response
            json_match = re.search(r"\{[\s\S]*\}", response)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(response)

            return {
                "sql": parsed.get("sql", ""),
                "summary": parsed.get("summary", ""),
                "chart_hint": parsed.get("chart_hint"),
                "date_range_applied": parsed.get("date_range_applied", False),
                "limit_applied": parsed.get("limit_applied", False),
            }
        except json.JSONDecodeError:
            # Fallback: treat entire response as SQL
            return {
                "sql": response.strip(),
                "summary": "Generated SQL query",
                "chart_hint": None,
                "date_range_applied": False,
                "limit_applied": False,
            }

    def _get_default_system_prompt(self) -> str:
        return """You are an e-commerce analytics SQL generation agent.

Generate SELECT queries following these rules STRICTLY:

1. ALWAYS use named placeholders (NOT inline values):
   - :currentUserId for individual user ID
   - :allowedStoreIds for corporate store IDs (comma-separated list)
   - :selectedStoreId for specific store queries
   - :startDate and :endDate for date ranges (YYYY-MM-DD)
   - :limit for row limit

2. NEVER write inline user IDs or store IDs

3. Role-based access:
   - ADMIN: Full analytics, but NO credentials, password, email, phone, address columns
   - CORPORATE: Only their own stores, no raw customer PII
   - INDIVIDUAL: Only their own orders/data

4. Default date range is last 30 days if not specified

5. Use appropriate LIMIT (default 100, max 500)

6. Output JSON format:
{
  "sql": "SELECT ... FROM ... WHERE ...",
  "summary": "What this query returns in Turkish/English",
  "chart_hint": "bar" or "line" or "pie" or null
}

Allowed tables: stores, products, categories, orders, order_items, shipments, reviews, customer_profiles, currency_rates, payments, payment_methods
"""

    def _get_default_user_prompt(self) -> str:
        return """Generate SQL for this question: {question}

Schema context:
{schema_context}

User role: {user_role}
{store_info}

Current date: {current_date}

Conversation memory (recent Q&A):
{conversation_memory}

Respond with JSON only containing sql, summary, and chart_hint fields."""


sql_generation_agent = SQLGenerationAgent()


def generate_sql(
    question: str,
    schema_context: Dict[str, Any],
    user_role: str,
    allowed_store_ids: List[int],
    selected_store_id: Optional[int],
    conversation_memory: List[Dict[str, Any]],
    current_date: str,
    language: str = "en",
) -> Dict[str, Any]:
    """Convenience function for SQL generation."""
    return sql_generation_agent.generate(
        question=question,
        schema_context=schema_context,
        user_role=user_role,
        allowed_store_ids=allowed_store_ids,
        selected_store_id=selected_store_id,
        conversation_memory=conversation_memory,
        current_date=current_date,
        language=language,
    )
