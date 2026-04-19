"""Deterministic visualization agent for analytics query results."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
import re
from typing import Any, Dict, List, Optional


TIME_COLUMN_RE = re.compile(r"(date|day|week|month|year|time|created|updated)", re.IGNORECASE)
ID_COLUMN_RE = re.compile(r"(^id$|_id$| id$)", re.IGNORECASE)
CURRENCY_COLUMN_RE = re.compile(r"currency", re.IGNORECASE)
MONEY_COLUMN_RE = re.compile(r"(revenue|sales|amount|total|price|cost|fee|spend|ciro|tutar)", re.IGNORECASE)
COUNT_COLUMN_RE = re.compile(r"(count|qty|quantity|orders|adet|siparis|review_count)", re.IGNORECASE)
RATING_COLUMN_RE = re.compile(r"(rating|score|puan)", re.IGNORECASE)
PIE_KEYWORD_RE = re.compile(
    r"(distribution|breakdown|share|oran|dagilim|dağılım|yuzde|yüzde|percent|ratio|composition|mix|split|rating)",
    re.IGNORECASE,
)

COLORWAY = [
    "#0f766e",
    "#2563eb",
    "#f59e0b",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
    "#65a30d",
    "#ea580c",
]

STATUS_COLORS = {
    "completed": "#16a34a",
    "delivered": "#16a34a",
    "paid": "#16a34a",
    "shipped": "#2563eb",
    "pending": "#f59e0b",
    "processing": "#0ea5e9",
    "cancelled": "#dc2626",
    "canceled": "#dc2626",
    "failed": "#dc2626",
    "returned": "#7c3aed",
}


@dataclass
class ChartSeries:
    name: str
    data: list[dict[str, Any]]


class VisualizationAgent:
    """Build a chart spec from query results without LLM output."""

    def create_visualization(
        self,
        query_result: Dict[str, Any],
        chart_hint: Optional[str],
        language: str = "en",
        sql_summary: Optional[str] = None,
    ) -> Dict[str, Any]:
        columns = query_result.get("columns") or []
        rows = query_result.get("rows") or []
        if len(columns) < 2 or len(rows) < 1:
            return self._skip("Not enough data for chart")

        data = self._rows_to_dicts(columns, rows)
        if not data:
            return self._skip("Query result could not be normalized")

        # Wide-format single-row → long-format transform.
        # When exactly 1 row is returned with multiple numeric columns (e.g. a
        # cross-tab summary like female_pct | male_pct | total), transpose it so
        # each numeric column becomes its own row. This lets pie/bar charts render
        # distribution summaries that would otherwise be skipped.
        if len(data) == 1:
            data = self._maybe_transpose_wide_row(data[0])
            if len(data) < 2:
                return self._skip("Not enough data for chart")

        chart_type = self._choose_chart_type(data, chart_hint, sql_summary)
        if not chart_type:
            return self._skip("No suitable chart pattern detected")

        chart = self._build_with_fallbacks(
            chart_type=chart_type,
            data=data,
            language=language,
            sql_summary=sql_summary,
            chart_hint=chart_hint,
        )
        if not chart:
            return self._skip("Chart rules rejected this result")

        return {
            "chart_type": chart.get("type"),
            "visualization": chart,
        }

    def _skip(self, reason: str) -> Dict[str, Any]:
        return {
            "chart_type": None,
            "visualization": None,
            "reason": reason,
        }

    def _rows_to_dicts(self, columns: list[str], rows: list[list[Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, list):
                continue
            normalized.append({column: row[index] if index < len(row) else None for index, column in enumerate(columns)})
        return normalized

    def _maybe_transpose_wide_row(self, row: dict[str, Any]) -> list[dict[str, Any]]:
        """Transpose a single wide-format row into multiple long-format rows.

        Each numeric column that is not an ID or a "total" aggregate becomes its
        own row with {"category": <column_label>, "value": <numeric_value>}.
        Non-numeric columns and totals/aggregates are excluded so they do not
        pollute the chart (e.g. a 'total_customers' column would dwarf percentages).
        """
        numeric_cols = [
            col for col, val in row.items()
            if self._is_numeric(val)
            and not ID_COLUMN_RE.search(col)
            and not re.search(r"\b(total|grand|sum|count|all)\b", col, re.IGNORECASE)
        ]
        if len(numeric_cols) < 2:
            return [row]
        return [
            {"category": col.replace("_", " ").strip().title(), "value": self._to_number(row[col])}
            for col in numeric_cols
        ]

    def _build_with_fallbacks(
        self,
        chart_type: str,
        data: list[dict[str, Any]],
        language: str,
        sql_summary: Optional[str],
        chart_hint: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        builders = {
            "line": lambda **kw: self._build_line_chart(**kw),
            "bar": lambda **kw: self._build_bar_chart(**kw),
            "pie": lambda **kw: self._build_pie_chart(**kw),
        }
        fallback_order = {
            "line": ["line", "bar", "pie"],
            "bar": ["bar", "pie", "line"],
            "pie": ["pie", "bar", "line"],
        }
        for candidate in fallback_order.get(chart_type, [chart_type]):
            builder = builders.get(candidate)
            if not builder:
                continue
            chart = builder(
                data=data,
                language=language,
                sql_summary=sql_summary,
                chart_hint=chart_hint,
            )
            if chart:
                return chart
        return None

    def _choose_chart_type(
        self,
        data: list[dict[str, Any]],
        chart_hint: Optional[str],
        sql_summary: Optional[str],
    ) -> Optional[str]:
        hint = (chart_hint or "").lower()
        if hint in {"line", "bar", "pie"}:
            return hint

        time_col = self._find_time_column(data)
        metric_col = self._find_metric_column(data)
        category_col = self._find_category_column(data)
        summary = (sql_summary or "").lower()

        if time_col and metric_col:
            return "line"

        if category_col and metric_col:
            if self._should_use_pie(data, category_col, metric_col, summary):
                return "pie"
            return "bar"

        # When the LLM hinted a chart type but column detection failed,
        # still try the hinted type — the builder may succeed with looser matching.
        if hint in {"line", "bar", "pie"}:
            return hint
        if metric_col:
            return "bar"

        return None

    def _find_time_column(self, data: list[dict[str, Any]]) -> Optional[str]:
        first = data[0]
        for column in first:
            if TIME_COLUMN_RE.search(column) and self._looks_like_time_value(column, first.get(column)):
                return column
        return None

    def _find_category_column(self, data: list[dict[str, Any]]) -> Optional[str]:
        first = data[0]
        preferred: list[str] = []
        numeric_preferred: list[str] = []
        numeric_fallback: list[str] = []
        fallback: list[str] = []
        for column, value in first.items():
            lower = column.lower()
            if CURRENCY_COLUMN_RE.search(lower):
                continue
            if TIME_COLUMN_RE.search(lower) and self._looks_like_time_value(column, value):
                continue
            if ID_COLUMN_RE.search(lower):
                fallback.append(column)
                continue
            if self._is_numeric(value):
                if self._is_ordinal_category_column(column, data):
                    numeric_preferred.append(column)
                elif self._is_low_cardinality_numeric_category(column, data):
                    numeric_fallback.append(column)
                continue
            if any(token in lower for token in (
                "title", "name", "status", "category", "brand", "seller",
                "gender", "type", "level", "tier", "segment", "membership",
            )):
                preferred.append(column)
            else:
                fallback.append(column)
        if preferred:
            return preferred[0]
        if numeric_preferred:
            return numeric_preferred[0]
        if fallback:
            return fallback[0]
        return numeric_fallback[0] if numeric_fallback else None

    def _find_currency_column(self, data: list[dict[str, Any]]) -> Optional[str]:
        first = data[0]
        for column in first:
            if CURRENCY_COLUMN_RE.search(column):
                return column
        return None

    def _find_metric_column(self, data: list[dict[str, Any]]) -> Optional[str]:
        first = data[0]
        varying_preferred: list[str] = []
        constant_preferred: list[str] = []
        varying_fallback: list[str] = []
        constant_fallback: list[str] = []
        ordinal_varying_fallback: list[str] = []
        ordinal_constant_fallback: list[str] = []
        for column, value in first.items():
            lower = column.lower()
            if not self._is_numeric(value):
                continue
            if ID_COLUMN_RE.search(lower):
                continue
            is_constant = self._is_constant_numeric_column(column, data)
            if self._is_ordinal_category_column(column, data):
                if is_constant:
                    ordinal_constant_fallback.append(column)
                else:
                    ordinal_varying_fallback.append(column)
                continue
            if MONEY_COLUMN_RE.search(lower) or COUNT_COLUMN_RE.search(lower) or RATING_COLUMN_RE.search(lower):
                if is_constant:
                    constant_preferred.append(column)
                else:
                    varying_preferred.append(column)
            else:
                if is_constant:
                    constant_fallback.append(column)
                else:
                    varying_fallback.append(column)
        if varying_preferred:
            return varying_preferred[0]
        if varying_fallback:
            return varying_fallback[0]
        if constant_preferred:
            return constant_preferred[0]
        if constant_fallback:
            return constant_fallback[0]
        if ordinal_varying_fallback:
            return ordinal_varying_fallback[0]
        return ordinal_constant_fallback[0] if ordinal_constant_fallback else None

    def _build_line_chart(
        self,
        data: list[dict[str, Any]],
        language: str,
        sql_summary: Optional[str],
        chart_hint: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        time_col = self._find_time_column(data)
        metric_col = self._find_metric_column(data)
        if not time_col or not metric_col:
            return None

        currency_col = self._find_currency_column(data)
        if self._has_mixed_currency(data, currency_col) and MONEY_COLUMN_RE.search(metric_col):
            return self._build_multi_currency_line_chart(data, time_col, metric_col, currency_col, language, sql_summary)

        sorted_rows = sorted(data, key=lambda row: self._time_sort_key(row.get(time_col)))
        series = [{
            "name": self._label(metric_col, language),
            "data": [{"x": row.get(time_col), "y": self._to_number(row.get(metric_col))} for row in sorted_rows],
        }]
        plotly = {
            "data": [{
                "type": "scatter",
                "mode": "lines+markers",
                "x": [point["x"] for point in series[0]["data"]],
                "y": [point["y"] for point in series[0]["data"]],
                "name": series[0]["name"],
                "line": {"color": COLORWAY[1], "shape": "spline", "width": 3},
                "marker": {"size": 7, "color": COLORWAY[1]},
                "fill": "tozeroy" if MONEY_COLUMN_RE.search(metric_col.lower()) else None,
                "fillcolor": "rgba(37, 99, 235, 0.12)",
            }],
            "layout": self._layout(
                title=self._title("line", language, sql_summary, metric_col),
                x_label=self._label(time_col, language),
                y_label=self._label(metric_col, language),
            ),
        }
        return self._chart_payload(
            chart_type="line",
            language=language,
            title=self._title("line", language, sql_summary, metric_col),
            x_label=self._label(time_col, language),
            y_label=self._label(metric_col, language),
            series=series,
            notes=self._notes_for_currency(data, currency_col, language),
            plotly=plotly,
        )

    def _build_multi_currency_line_chart(
        self,
        data: list[dict[str, Any]],
        time_col: str,
        metric_col: str,
        currency_col: Optional[str],
        language: str,
        sql_summary: Optional[str],
    ) -> Optional[dict[str, Any]]:
        if not currency_col:
            return None

        grouped_rows: dict[str, list[dict[str, Any]]] = {}
        ordered_currencies: list[str] = []
        for row in data:
            currency = str(row.get(currency_col) or "").strip().upper()
            if not currency or currency == "MIXED":
                continue
            if currency not in grouped_rows:
                grouped_rows[currency] = []
                ordered_currencies.append(currency)
            grouped_rows[currency].append(row)

        if len(grouped_rows) < 2:
            return None

        series: list[dict[str, Any]] = []
        plotly_series: list[dict[str, Any]] = []
        for index, currency in enumerate(ordered_currencies):
            sorted_rows = sorted(grouped_rows[currency], key=lambda row: self._time_sort_key(row.get(time_col)))
            points = [{"x": row.get(time_col), "y": self._to_number(row.get(metric_col))} for row in sorted_rows]
            series.append({"name": currency, "data": points})
            plotly_series.append({
                "type": "scatter",
                "mode": "lines+markers",
                "x": [point["x"] for point in points],
                "y": [point["y"] for point in points],
                "name": currency,
                "line": {"color": COLORWAY[index % len(COLORWAY)], "shape": "spline", "width": 3},
                "marker": {"size": 7, "color": COLORWAY[index % len(COLORWAY)]},
            })

        title = self._title("line", language, sql_summary, metric_col)
        note = (
            "Different currencies are shown as separate trend lines."
            if language == "en"
            else "Farkli para birimleri ayri trend cizgileri olarak gosterildi."
        )
        return self._chart_payload(
            chart_type="line",
            language=language,
            title=title,
            x_label=self._label(time_col, language),
            y_label=self._label(metric_col, language),
            series=series,
            notes=[note],
            plotly={
                "data": plotly_series,
                "layout": self._layout(
                    title=title,
                    x_label=self._label(time_col, language),
                    y_label=self._label(metric_col, language),
                ),
            },
        )

    def _build_bar_chart(
        self,
        data: list[dict[str, Any]],
        language: str,
        sql_summary: Optional[str],
        chart_hint: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        category_col = self._find_category_column(data)
        metric_col = self._find_metric_column(data)
        if not category_col or not metric_col:
            return None

        currency_col = self._find_currency_column(data)
        if self._has_mixed_currency(data, currency_col) and MONEY_COLUMN_RE.search(metric_col.lower()):
            return self._build_grouped_currency_bar_chart(data, category_col, metric_col, currency_col, language, sql_summary, chart_hint)

        limited = self._top_rows(data, metric_col)
        series = [{
            "name": self._label(metric_col, language),
            "data": [{"x": row.get(category_col), "y": self._to_number(row.get(metric_col))} for row in limited],
        }]
        plotly = {
            "data": [{
                "type": "bar",
                "x": [point["x"] for point in series[0]["data"]],
                "y": [point["y"] for point in series[0]["data"]],
                "name": series[0]["name"],
                "marker": {
                    "color": [self._bar_color(point["x"]) for point in series[0]["data"]],
                },
            }],
            "layout": self._layout(
                title=self._title("bar", language, sql_summary, metric_col),
                x_label=self._label(category_col, language),
                y_label=self._label(metric_col, language),
            ),
        }
        return self._chart_payload(
            chart_type="bar",
            language=language,
            title=self._title("bar", language, sql_summary, metric_col),
            x_label=self._label(category_col, language),
            y_label=self._label(metric_col, language),
            series=series,
            notes=self._notes_for_currency(data, currency_col, language),
            plotly=plotly,
        )

    def _build_grouped_currency_bar_chart(
        self,
        data: list[dict[str, Any]],
        category_col: str,
        metric_col: str,
        currency_col: Optional[str],
        language: str,
        sql_summary: Optional[str],
        chart_hint: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        if not currency_col:
            return None

        limited = self._top_rows(data, metric_col)
        currencies = []
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in limited:
            currency = str(row.get(currency_col) or "MIXED")
            if currency not in grouped:
                grouped[currency] = []
                currencies.append(currency)
            grouped[currency].append({
                "x": row.get(category_col),
                "y": self._to_number(row.get(metric_col)),
            })

        if len(grouped) <= 1:
            return None

        series: list[dict[str, Any]] = []
        plotly_series: list[dict[str, Any]] = []
        for index, currency in enumerate(currencies):
            points = grouped[currency]
            series.append({"name": currency, "data": points})
            plotly_series.append({
                "type": "bar",
                "name": currency,
                "x": [point["x"] for point in points],
                "y": [point["y"] for point in points],
                "marker": {"color": COLORWAY[index % len(COLORWAY)]},
            })

        title = self._title("bar", language, sql_summary, metric_col)
        note = (
            "Multiple currencies are shown as separate series to avoid false totals."
            if language == "en"
            else "Yanlis toplam olusmaması icin farkli para birimleri ayri seriler halinde gosterildi."
        )
        return self._chart_payload(
            chart_type="bar",
            language=language,
            title=title,
            x_label=self._label(category_col, language),
            y_label=self._label(metric_col, language),
            series=series,
            notes=[note],
            plotly={
                "data": plotly_series,
                "layout": self._layout(
                    title=title,
                    x_label=self._label(category_col, language),
                    y_label=self._label(metric_col, language),
                    barmode="group",
                ),
            },
        )

    def _build_pie_chart(
        self,
        data: list[dict[str, Any]],
        language: str,
        sql_summary: Optional[str],
        chart_hint: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        category_col = self._find_category_column(data)
        metric_col = self._find_metric_column(data)
        if not category_col or not metric_col or len(data) > 10:
            return None

        currency_col = self._find_currency_column(data)
        if self._has_mixed_currency(data, currency_col) and MONEY_COLUMN_RE.search(metric_col.lower()):
            return None

        if self._find_time_column(data):
            return None

        # When chart_hint explicitly requests a pie, skip the category friendliness
        # check — the LLM already decided this data suits a pie chart.
        if chart_hint != "pie" and not self._is_pie_friendly_category(category_col, data):
            return None

        series = [{
            "name": self._label(metric_col, language),
            "data": [{"x": row.get(category_col), "y": self._to_number(row.get(metric_col))} for row in data],
        }]
        plotly = {
            "data": [{
                "type": "pie",
                "labels": [point["x"] for point in series[0]["data"]],
                "values": [point["y"] for point in series[0]["data"]],
                "hole": 0.45,
                "marker": {"colors": COLORWAY[: len(series[0]["data"])]},
            }],
            "layout": self._layout(
                title=self._title("pie", language, sql_summary, metric_col),
                x_label="",
                y_label="",
            ),
        }
        return self._chart_payload(
            chart_type="pie",
            language=language,
            title=self._title("pie", language, sql_summary, metric_col),
            x_label=self._label(category_col, language),
            y_label=self._label(metric_col, language),
            series=series,
            notes=self._notes_for_currency(data, currency_col, language),
            plotly=plotly,
        )

    def _chart_payload(
        self,
        chart_type: str,
        language: str,
        title: str,
        x_label: str,
        y_label: str,
        series: list[dict[str, Any]],
        notes: list[str],
        plotly: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "type": chart_type,
            "title": title,
            "xLabel": x_label,
            "yLabel": y_label,
            "series": series,
            "notes": notes,
            "plotly": plotly,
        }

    def _layout(self, title: str, x_label: str, y_label: str, barmode: str = "relative") -> dict[str, Any]:
        return {
            "title": {"text": title, "x": 0.02, "xanchor": "left"},
            "paper_bgcolor": "#ffffff",
            "plot_bgcolor": "#ffffff",
            "margin": {"l": 56, "r": 20, "t": 56, "b": 56},
            "font": {"family": "Inter, system-ui, sans-serif", "size": 12, "color": "#0f172a"},
            "xaxis": {
                "title": {"text": x_label},
                "tickangle": -25,
                "automargin": True,
                "gridcolor": "#e2e8f0",
                "zerolinecolor": "#cbd5e1",
            },
            "yaxis": {
                "title": {"text": y_label},
                "automargin": True,
                "gridcolor": "#e2e8f0",
                "zerolinecolor": "#cbd5e1",
            },
            "legend": {"orientation": "h", "y": -0.2},
            "barmode": barmode,
            "hovermode": "x unified",
        }

    def _notes_for_currency(self, data: list[dict[str, Any]], currency_col: Optional[str], language: str) -> list[str]:
        if not currency_col:
            return []
        values = {str(row.get(currency_col)).upper() for row in data if row.get(currency_col)}
        if len(values) <= 1:
            return []
        return [
            "Results contain multiple currencies; avoid reading them as a single total."
            if language == "en"
            else "Sonuclar birden fazla para birimi iceriyor; tek toplam gibi yorumlamayin."
        ]

    def _top_rows(self, data: list[dict[str, Any]], metric_col: str, limit: int = 10) -> list[dict[str, Any]]:
        return sorted(
            data,
            key=lambda row: self._to_number(row.get(metric_col)) or 0,
            reverse=True,
        )[:limit]

    def _title(self, chart_type: str, language: str, sql_summary: Optional[str], metric_col: str) -> str:
        if sql_summary:
            return sql_summary.strip().rstrip(".")
        metric = self._label(metric_col, language)
        if chart_type == "line":
            return f"{metric} trend" if language == "en" else f"{metric} trendi"
        if chart_type == "pie":
            return f"{metric} distribution" if language == "en" else f"{metric} dagilimi"
        return f"{metric} comparison" if language == "en" else f"{metric} karsilastirmasi"

    def _label(self, column: str, language: str) -> str:
        label = column.replace("_", " ").strip().title()
        translations = {
            "tr": {
                "Store Name": "Magaza",
                "Product Title": "Urun",
                "Review Count": "Yorum Sayisi",
                "Avg Rating": "Ortalama Puan",
                "Total Revenue": "Toplam Gelir",
                "Total Sales": "Toplam Satis",
                "Order Count": "Siparis Sayisi",
                "Status": "Durum",
                "Date": "Tarih",
                "Day": "Gun",
                "Month": "Ay",
                "Week": "Hafta",
                "Currency": "Para Birimi",
            }
        }
        return translations.get(language, {}).get(label, label)

    def _bar_color(self, label: Any) -> str:
        normalized = str(label or "").strip().lower()
        for key, color in STATUS_COLORS.items():
            if key in normalized:
                return color
        return COLORWAY[0]

    def _has_mixed_currency(self, data: list[dict[str, Any]], currency_col: Optional[str]) -> bool:
        if not currency_col:
            return False
        currencies = {
            str(row.get(currency_col)).strip().upper()
            for row in data
            if row.get(currency_col) not in (None, "")
        }
        return len(currencies) > 1

    def _should_use_pie(
        self,
        data: list[dict[str, Any]],
        category_col: str,
        metric_col: str,
        summary: str,
    ) -> bool:
        if len(data) > 10:
            return False
        if not self._is_pie_friendly_category(category_col, data):
            return False
        if PIE_KEYWORD_RE.search(summary):
            return True
        if RATING_COLUMN_RE.search(category_col):
            return True
        if COUNT_COLUMN_RE.search(metric_col) or "percentage" in metric_col.lower():
            return True
        return False

    def _is_pie_friendly_category(self, column: str, data: list[dict[str, Any]]) -> bool:
        distinct = self._distinct_non_null_values(column, data)
        if len(distinct) < 2 or len(distinct) > 10:
            return False
        lower = column.lower()
        # High-cardinality name/title columns with many slices look bad in pie.
        if any(token in lower for token in ("title", "name")) and len(distinct) > 5:
            return False
        # Any column with 2-10 distinct string values is pie-friendly.
        # This covers gender, status, category, membership, tier, segment, etc.
        if not self._is_numeric(next(iter(data), {}).get(column)):
            return True
        return self._is_low_cardinality_numeric_category(column, data)

    def _is_ordinal_category_column(self, column: str, data: list[dict[str, Any]]) -> bool:
        lower = column.lower()
        numeric_values = self._numeric_values(column, data)
        if not numeric_values:
            return False
        if RATING_COLUMN_RE.search(lower):
            return all(0 <= value <= 10 for value in numeric_values) and len(set(numeric_values)) <= 10
        if "month" in lower:
            return all(1 <= value <= 12 for value in numeric_values)
        if "week" in lower:
            return all(1 <= value <= 53 for value in numeric_values)
        if "year" in lower:
            return all(2000 <= value <= 2100 for value in numeric_values) and len(set(numeric_values)) <= 12
        return False

    def _is_low_cardinality_numeric_category(self, column: str, data: list[dict[str, Any]]) -> bool:
        lower = column.lower()
        if ID_COLUMN_RE.search(lower):
            return False
        numeric_values = self._numeric_values(column, data)
        if not numeric_values:
            return False
        distinct = set(numeric_values)
        if len(distinct) > 10:
            return False
        return len(distinct) < max(2, len(numeric_values))

    def _distinct_non_null_values(self, column: str, data: list[dict[str, Any]]) -> set[str]:
        return {str(row.get(column)).strip() for row in data if row.get(column) not in (None, "")}

    def _numeric_values(self, column: str, data: list[dict[str, Any]]) -> list[float]:
        values: list[float] = []
        for row in data:
            number = self._to_number(row.get(column))
            if number is not None:
                values.append(number)
        return values

    def _is_constant_numeric_column(self, column: str, data: list[dict[str, Any]]) -> bool:
        numeric_values = self._numeric_values(column, data)
        if len(numeric_values) < 2:
            return True
        return len(set(numeric_values)) == 1

    def _is_numeric(self, value: Any) -> bool:
        if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
            return True
        if isinstance(value, str):
            try:
                float(value.replace(",", ""))
                return True
            except ValueError:
                return False
        return False

    def _to_number(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.replace(",", ""))
            except ValueError:
                return None
        return None

    def _looks_like_time_value(self, column: str, value: Any) -> bool:
        if value is None:
            return False
        lower = column.lower()
        if isinstance(value, datetime):
            return True
        number = self._to_number(value)
        if number is not None:
            if "month" in lower and 1 <= number <= 12:
                return True
            if "week" in lower and 1 <= number <= 53:
                return True
            if "year" in lower and 2000 <= number <= 2100:
                return True
        text = str(value).strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}", text):
            return True
        return text.lower()[:3] in {"mon", "tue", "wed", "thu", "fri", "sat", "sun", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"}

    def _time_sort_key(self, value: Any) -> Any:
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value
        text = str(value).strip()
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return text


visualization_agent = VisualizationAgent()


def create_chart(
    query_result: Dict[str, Any],
    chart_hint: Optional[str],
    language: str = "en",
    sql_summary: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenience function for visualization."""
    return visualization_agent.create_visualization(
        query_result=query_result,
        chart_hint=chart_hint,
        language=language,
        sql_summary=sql_summary,
    )
