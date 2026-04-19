"""Error Repair Agent - Task 5.2 (stub)"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class ErrorRepairAgent:
    """
    LLM-powered agent that attempts to fix failed SQL queries.

    Takes the original SQL, error message, and schema context
    to generate a corrected query.
    """

    MAX_RETRIES = 2

    def __init__(self):
        base_dir = Path(__file__).parent.parent
        self._system_prompt_path = base_dir / "prompts" / "error_repair_system.txt"
        self._user_prompt_path = base_dir / "prompts" / "error_repair_user.txt"
        self._system_prompt: Optional[str] = None
        self._user_prompt_template: Optional[str] = None

    def repair(
        self,
        original_sql: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]],
        schema_context: Dict[str, Any],
        question: str,
        conversation_memory: List[Dict[str, Any]],
        user_role: str = "INDIVIDUAL",
        allowed_store_ids: Optional[List[str]] = None,
        selected_store_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Attempt to repair a failed SQL query.

        Returns:
            {
                "sql": "Corrected SELECT query",
                "action": "What was changed",
                "still_failing": False
            }
        """
        if settings.is_mock_mode:
            return self._mock_repair(original_sql, error_message)

        system_prompt = self._load_system_prompt()
        user_prompt = self._build_user_prompt(
            original_sql=original_sql,
            error_message=error_message,
            error_details=error_details or {},
            schema_context=schema_context,
            question=question,
            conversation_memory=conversation_memory,
            user_role=user_role,
            allowed_store_ids=allowed_store_ids or [],
            selected_store_id=selected_store_id,
        )

        model = settings.get_model_for_agent("repair") or "anthropic/claude-sonnet-4.6"

        try:
            response = self._call_llm(model, system_prompt, user_prompt)
            return self._parse_response(response)
        except Exception as e:
            logger.error(f"Error repair failed: {e}")
            raise

    def _mock_repair(self, original_sql: str, error_message: str) -> Dict[str, Any]:
        """Return a mock repair for development testing."""
        return {
            "sql": original_sql + " -- repaired",
            "action": "mock repair",
            "still_failing": False,
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
        original_sql: str,
        error_message: str,
        error_details: Dict[str, Any],
        schema_context: Dict[str, Any],
        question: str,
        conversation_memory: List[Dict[str, Any]],
        user_role: str,
        allowed_store_ids: List[str],
        selected_store_id: Optional[str],
    ) -> str:
        template = self._load_user_prompt_template()
        schema_json = json.dumps(schema_context, indent=2, ensure_ascii=False)
        error_details_json = json.dumps(error_details, indent=2, ensure_ascii=False) if error_details else "{}"

        memory_text = ""
        if conversation_memory:
            memory_lines = []
            for pair in conversation_memory[-4:]:  # Last 4 pairs
                memory_lines.append(f"User: {pair.get('question', '')}")
                memory_lines.append(f"Assistant: {pair.get('answer_summary', '')}")
            memory_text = "\n".join(memory_lines)

        role_scope = [f"User role: {user_role}"]
        if user_role == "CORPORATE":
            if allowed_store_ids:
                role_scope.append(f"Allowed store IDs: {', '.join(map(str, allowed_store_ids))}")
            if selected_store_id:
                role_scope.append(f"Selected store ID: {selected_store_id}")
            role_scope.append("CORPORATE repair rule: use :allowedStoreIds or :selectedStoreId when store scoping is required.")
        elif user_role == "INDIVIDUAL":
            role_scope.append("INDIVIDUAL repair rule: use :currentUserId when user scoping is required.")
        elif user_role == "ADMIN":
            role_scope.append("ADMIN repair rule: do NOT use :allowedStoreIds, :selectedStoreId, or :currentUserId placeholders.")
        role_scope_text = "\n".join(role_scope)

        return template.format(
            original_sql=original_sql,
            error_message=error_message,
            error_details=error_details_json,
            schema_context=schema_json,
            question=question,
            conversation_memory=memory_text,
            role_scope=role_scope_text,
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
            "temperature": 0.2,
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
        """Parse LLM response into repair output."""
        try:
            json_match = re.search(r"\{[\s\S]*\}", response)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(response)

            return {
                "sql": parsed.get("sql", ""),
                "action": parsed.get("action", "modified"),
                "still_failing": parsed.get("still_failing", False),
            }
        except json.JSONDecodeError:
            return {
                "sql": response.strip(),
                "action": "raw response",
                "still_failing": False,
            }

    def _get_default_system_prompt(self) -> str:
        return """You are an SQL error repair agent.

Given a failed SQL query and an error message, generate a corrected version.

Rules:
1. Keep using named placeholders (:currentUserId, :allowedStoreIds, etc.)
2. Fix the syntax or logic error that caused the failure
3. Keep the same semantic intent as the original query
4. Do NOT change the query structure unnecessarily
5. If the error is unrepairable, return the original SQL with "unrepaired" action

Output JSON format:
{
  "sql": "corrected SELECT query",
  "action": "brief description of what was fixed",
  "still_failing": true or false
}
"""

    def _get_default_user_prompt(self) -> str:
        return """Fix this SQL query:

Original SQL:
{original_sql}

Error message:
{error_message}

Structured validator details:
{error_details}

Schema context:
{schema_context}

Original question: {question}

Recent conversation:
{conversation_memory}

Respond with JSON only."""


error_repair_agent = ErrorRepairAgent()


def repair_sql(
    original_sql: str,
    error_message: str,
    error_details: Optional[Dict[str, Any]],
    schema_context: Dict[str, Any],
    question: str,
    conversation_memory: List[Dict[str, Any]],
    user_role: str = "INDIVIDUAL",
    allowed_store_ids: Optional[List[str]] = None,
    selected_store_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenience function for error repair."""
    return error_repair_agent.repair(
        original_sql=original_sql,
        error_message=error_message,
        error_details=error_details,
        schema_context=schema_context,
        question=question,
        conversation_memory=conversation_memory,
        user_role=user_role,
        allowed_store_ids=allowed_store_ids,
        selected_store_id=selected_store_id,
    )
