"""Analysis agent."""

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class AnalysisAgent:
    """Explain query results in the user's language."""

    def __init__(self):
        base_dir = Path(__file__).parent.parent
        self._system_prompt_path = base_dir / "prompts" / "analysis_system.txt"
        self._user_prompt_path = base_dir / "prompts" / "analysis_user.txt"
        self._system_prompt: Optional[str] = None
        self._user_prompt_template: Optional[str] = None

    def analyze(
        self,
        query_result: Dict[str, Any],
        language: str,
        chart_hint: Optional[str],
        sql_summary: Optional[str],
        row_count: Optional[int],
        date_range_applied: bool = False,
        limit_applied: bool = False,
    ) -> Dict[str, Any]:
        if settings.is_mock_mode:
            return {"answer": f"Mock analysis: Query returned {row_count or 0} rows."}

        system_prompt = self._load_system_prompt()
        user_prompt = self._build_user_prompt(
            query_result=query_result,
            language=language,
            chart_hint=chart_hint,
            sql_summary=sql_summary,
            row_count=row_count,
            date_range_applied=date_range_applied,
            limit_applied=limit_applied,
        )

        model = settings.get_model_for_agent("analysis") or "anthropic/claude-haiku-4.5"
        try:
            return {"answer": self._call_llm(model, system_prompt, user_prompt).strip()}
        except Exception as exc:
            logger.error("Analysis failed: %s", exc)
            raise

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
        query_result: Dict[str, Any],
        language: str,
        chart_hint: Optional[str],
        sql_summary: Optional[str],
        row_count: Optional[int],
        date_range_applied: bool = False,
        limit_applied: bool = False,
    ) -> str:
        template = self._load_user_prompt_template()
        result_json = json.dumps(query_result, indent=2, ensure_ascii=False)
        lang_instruction = "Respond in Turkish." if language == "tr" else "Respond in English."

        return template.format(
            sql_summary=sql_summary or "Query executed",
            row_count=row_count or 0,
            result_data=result_json[:2000],
            chart_note=_format_chart_note(chart_hint),
            language_instruction=lang_instruction,
            date_range_note=(
                "Note: The user did not specify a date range, so the default last 30 days was used."
                if date_range_applied
                else ""
            ),
            limit_note=(
                "Note: A row limit was applied because the user did not specify one."
                if limit_applied
                else ""
            ),
            currency_note=_format_currency_note(query_result),
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
            "temperature": 0.3,
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    def _get_default_system_prompt(self) -> str:
        return (
            "You are an e-commerce analytics analysis agent. "
            "Explain only what the returned data shows and never invent currencies."
        )

    def _get_default_user_prompt(self) -> str:
        return """{language_instruction}

Query: {sql_summary}
Rows returned: {row_count}

{currency_note}

Data:
{result_data}

{chart_note}

Provide a clear, concise explanation of what this data shows."""


def _format_chart_note(chart_hint: Optional[str]) -> str:
    if chart_hint:
        return f"A {chart_hint} chart visualization is available."
    return "No chart visualization needed for this data."


def _format_currency_note(query_result: Dict[str, Any]) -> str:
    columns = query_result.get("columns") or []
    rows = query_result.get("rows") or []
    currency_values: set[str] = set()

    for row in rows[:20]:
        if not isinstance(row, list):
            continue
        for index, column in enumerate(columns):
            if index >= len(row):
                continue
            if "currency" not in str(column).lower():
                continue
            normalized = str(row[index]).strip().upper()
            if re.fullmatch(r"[A-Z]{3}", normalized) or normalized == "MIXED":
                currency_values.add(normalized)

    if not currency_values:
        return (
            "Currency note: The result data does not contain explicit currency evidence. "
            "Do not name a currency in the answer."
        )
    if currency_values == {"MIXED"} or len(currency_values) > 1:
        return (
            "Currency note: The result contains multiple currencies or mixed-currency values. "
            "Do not present them as a single-currency total."
        )
    return f"Currency note: The result data explicitly uses {next(iter(currency_values))}."


analysis_agent = AnalysisAgent()


def analyze_results(
    query_result: Dict[str, Any],
    language: str,
    chart_hint: Optional[str],
    sql_summary: Optional[str],
    row_count: Optional[int],
    date_range_applied: bool = False,
    limit_applied: bool = False,
) -> Dict[str, Any]:
    return analysis_agent.analyze(
        query_result=query_result,
        language=language,
        chart_hint=chart_hint,
        sql_summary=sql_summary,
        row_count=row_count,
        date_range_applied=date_range_applied,
        limit_applied=limit_applied,
    )
