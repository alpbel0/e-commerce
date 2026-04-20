"""SQL Validator - validates SQL against security rules."""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Set, Dict, Any
import json
import re
from app.services.sql_parser import SQLParser, sql_parser, SQLQuery
from app.services.pii_policy import pii_policy, is_sensitive_column


# Allowed tables for analytics queries
ALLOWED_TABLES: Set[str] = {
    "stores",
    "products",
    "categories",
    "orders",
    "order_items",
    "shipments",
    "reviews",
    "customer_profiles",
    "currency_rates",
    "payments",
    "payment_methods",
}

# Forbidden keywords that indicate destructive/non-select operations
FORBIDDEN_KEYWORDS: Set[str] = {
    "insert", "update", "delete", "drop", "alter", "truncate",
    "create", "grant", "revoke", "copy", "call", "exec", "execute",
    "merge", "replace",
}

# Query limits
DEFAULT_LIMIT = 100
MAX_LIMIT = 500

PUBLIC_AGGREGATE_ALLOWED_TABLES: Set[str] = {
    "stores",
    "products",
    "categories",
    "reviews",
}


@dataclass
class ValidationResult:
    """Result of SQL validation."""
    is_valid: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    applied_defaults: List[str] = None

    def __post_init__(self):
        if self.applied_defaults is None:
            self.applied_defaults = []


class SQLValidator:
    """Validates SQL against security and policy rules."""

    def __init__(self, allowed_tables: Optional[Set[str]] = None):
        self._allowed_tables = allowed_tables or ALLOWED_TABLES
        self._forbidden_keywords = FORBIDDEN_KEYWORDS
        self._parser = sql_parser
        self._column_policies, self._table_metadata = self._load_schema_policies()

    def validate(
        self,
        sql: str,
        role: str = "INDIVIDUAL",
        access_mode: str = "PERSONAL",
        require_scope_filter: bool = True
    ) -> ValidationResult:
        """
        Validate SQL query against all security rules.

        Args:
            sql: SQL query string
            role: User role (ADMIN, CORPORATE, INDIVIDUAL)
            require_scope_filter: Whether to require scope filters (store/user)

        Returns:
            ValidationResult with is_valid and any error details
        """
        if not sql or sql.isspace():
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message="SQL query is required"
            )

        # Parse SQL
        query = self._parser.parse(sql)
        sql_lower = sql.lower()
        cte_sources, _ = self._extract_cte_sources(sql)

        # Rule 1: SELECT only
        if not self._is_select_query(query, sql_lower):
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message="Only SELECT queries are allowed"
            )

        # Rule 2: No multiple statements
        if self._has_multiple_statements(sql):
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message="Multiple statements are not allowed"
            )

        if self._has_comments(sql_lower):
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message="SQL comments are not allowed"
            )

        # Rule 3: No forbidden keywords
        forbidden = self._contains_forbidden_keywords(sql_lower)
        if forbidden:
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message=f"Forbidden SQL keyword: {forbidden}"
            )

        # Rule 4: No SELECT *
        if self._has_select_star(sql_lower, query):
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message="SELECT * is not allowed"
            )

        # Rule 5: Check table allowlist
        tables = self._get_all_tables(query)
        cte_names = {name.lower() for name in cte_sources}
        invalid_tables = [t for t in tables if t.lower() not in self._allowed_tables and t.lower() not in cte_names]
        if invalid_tables:
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message=f"Table not allowed: {invalid_tables[0]}"
            )

        # Rule 6: Check sensitive columns
        columns = query.columns
        sensitive = [c for c in columns if is_sensitive_column(c)]
        if sensitive:
            return ValidationResult(
                is_valid=False,
                error_code="PRIVACY_RISK",
                error_message=f"Sensitive column not allowed: {sensitive[0]}"
            )

        # Rule 7: Role scope check (placeholder-based)
        if require_scope_filter:
            scope_result = self._check_role_scope(sql, role, access_mode)
            if not scope_result.is_valid:
                return scope_result

        public_scope_result = self._check_public_aggregate_scope(tables, role, access_mode)
        if not public_scope_result.is_valid:
            return public_scope_result

        # Rule 8: Rating/review analytics must use reviews as source of truth
        rating_result = self._check_rating_source(sql_lower, tables)
        if not rating_result.is_valid:
            return rating_result

        # Rule 9: Reject unsafe aggregates on duplicated snapshot/derived metrics
        aggregation_result = self._check_unsafe_aggregations(sql)
        if not aggregation_result.is_valid:
            return aggregation_result

        # Rule 10: Check LIMIT
        applied_defaults = []
        if not query.has_limit:
            applied_defaults.append(f"LIMIT {DEFAULT_LIMIT}")

        # Rule 11: Converted-currency analytics must use safe generic conversion
        currency_conversion_result = self._check_currency_conversion_safety(sql, sql_lower)
        if not currency_conversion_result.is_valid:
            return currency_conversion_result

        return ValidationResult(
            is_valid=True,
            applied_defaults=applied_defaults
        )

    def _is_select_query(self, query: SQLQuery, sql_lower: str) -> bool:
        """Check if query is a SELECT statement."""
        return query.sql_type == "SELECT" or sql_lower.strip().startswith("select")

    def _has_multiple_statements(self, sql: str) -> bool:
        """Check for multiple statements."""
        # Remove comments first
        clean = sql
        # Remove single-line comments
        while '--' in clean:
            idx = clean.index('--')
            end = clean.index('\n', idx) if '\n' in clean[idx:] else len(clean)
            clean = clean[:idx] + clean[end:]
        # Remove multi-line comments
        while '/*' in clean:
            start = clean.index('/*')
            end = clean.index('*/', start) + 2 if '*/' in clean[start:] else len(clean)
            clean = clean[:start] + clean[end:]

        # Check for semicolons (except at end)
        parts = clean.split(';')
        if len(parts) > 2:
            return True
        if len(parts) == 2 and parts[1].strip():
            return True
        return False

    def _contains_forbidden_keywords(self, sql_lower: str) -> Optional[str]:
        """Check for forbidden keywords."""
        words = sql_lower.split()
        for word in words:
            # Remove punctuation
            clean_word = ''.join(c for c in word if c.isalnum())
            if clean_word in self._forbidden_keywords:
                return clean_word
        return None

    def _has_select_star(self, sql_lower: str, query: SQLQuery) -> bool:
        """Check if query uses SELECT *. COUNT(*) and similar aggregate functions are allowed."""
        # Bare SELECT * (not inside a function call)
        if re.search(r'\bselect\s+\*', sql_lower):
            return True
        # table.* wildcard
        if re.search(r"\b[a-zA-Z_][a-zA-Z0-9_]*\s*\.\s*\*", sql_lower):
            return True
        return False

    def _has_comments(self, sql_lower: str) -> bool:
        """Reject SQL comments before execution."""
        return "--" in sql_lower or "/*" in sql_lower or "*/" in sql_lower

    def _get_all_tables(self, query: SQLQuery) -> List[str]:
        """Get all table references from query."""
        tables = list(query.tables)
        tables.extend(query.join_tables)
        return tables if tables else []

    def _check_role_scope(self, sql: str, role: str, access_mode: str) -> ValidationResult:
        """Check that query has proper role-based scope filters."""
        sql_lower = sql.lower()
        normalized_access_mode = (access_mode or "PERSONAL").upper()

        if role == "CORPORATE":
            # Must have store scope
            has_store_scope = (
                ":allowedstoreids" in sql_lower or
                ":selectedstoreid" in sql_lower or
                "allowedstoreids" in sql_lower or
                "selectedstoreid" in sql_lower
            )
            if not has_store_scope:
                return ValidationResult(
                    is_valid=False,
                    error_code="SQL_SCOPE_VIOLATION",
                    error_message="Corporate queries must include store scope (allowedStoreIds or selectedStoreId)"
                )

        elif role == "INDIVIDUAL":
            if normalized_access_mode == "RESTRICTED_BUSINESS":
                return ValidationResult(
                    is_valid=False,
                    error_code="SQL_SCOPE_VIOLATION",
                    error_message="Individual users cannot access restricted business analytics"
                )
            if normalized_access_mode == "PUBLIC_AGGREGATE":
                return ValidationResult(is_valid=True)
            # Must have user scope
            has_user_scope = (
                ":currentuserid" in sql_lower or
                "currentuserid" in sql_lower
            )
            if not has_user_scope:
                return ValidationResult(
                    is_valid=False,
                    error_code="SQL_SCOPE_VIOLATION",
                    error_message="Individual queries must include user scope (currentUserId)"
                )

        elif role == "ADMIN":
            has_corporate_scope = (
                ":allowedstoreids" in sql_lower or
                "allowedstoreids" in sql_lower
            )
            has_individual_scope = (
                ":currentuserid" in sql_lower or
                "currentuserid" in sql_lower
            )
            if has_corporate_scope or has_individual_scope:
                return ValidationResult(
                    is_valid=False,
                    error_code="SQL_SCOPE_VIOLATION",
                    error_message=(
                        "Admin queries must not use CORPORATE or INDIVIDUAL scope placeholders "
                        "(allowedStoreIds/currentUserId)"
                    )
                )

        # ADMIN can query without explicit scope (has platform-wide access)
        return ValidationResult(is_valid=True)

    def _check_public_aggregate_scope(
        self,
        tables: List[str],
        role: str,
        access_mode: str,
    ) -> ValidationResult:
        if role != "INDIVIDUAL" or (access_mode or "PERSONAL").upper() != "PUBLIC_AGGREGATE":
            return ValidationResult(is_valid=True)

        normalized_tables = {table.lower() for table in tables}
        invalid_tables = sorted(normalized_tables - PUBLIC_AGGREGATE_ALLOWED_TABLES)
        if invalid_tables:
            return ValidationResult(
                is_valid=False,
                error_code="SQL_SCOPE_VIOLATION",
                error_message=(
                    "Individual public aggregate queries may only use products, categories, stores, and reviews "
                    f"(found disallowed table: {invalid_tables[0]})"
                ),
            )

        return ValidationResult(is_valid=True)

    def _check_rating_source(self, sql_lower: str, tables: List[str]) -> ValidationResult:
        """Reject rating/ranking queries that rely on empty denormalized columns instead of reviews."""
        normalized_tables = {table.lower() for table in tables}
        touches_denormalized_rating = any(token in sql_lower for token in (
            "p.avg_rating",
            "products.avg_rating",
            "p.review_count",
            "products.review_count",
            "s.rating",
            "stores.rating",
        ))
        if not touches_denormalized_rating:
            return ValidationResult(is_valid=True)

        if "reviews" not in normalized_tables:
            return ValidationResult(
                is_valid=False,
                error_code="SQL_VALIDATION_FAILED",
                error_message=(
                    "Rating and review analytics must aggregate from reviews.star_rating via "
                    "reviews -> products -> stores, not stored rating columns"
                ),
            )

        return ValidationResult(is_valid=True)

    def _check_currency_conversion_safety(self, sql: str, sql_lower: str) -> ValidationResult:
        """Reject USD/EUR/TRY-labeled conversions that still fall back to raw native amounts."""
        converted_alias_present = re.search(
            r"\bas\s+(?:total_)?(?:revenue|sales|amount)_(usd|eur|try|gbp|inr|pkr|aud|cad)\b",
            sql_lower,
        ) is not None
        explicit_converted_label = (
            converted_alias_present or
            "'usd' as currency" in sql_lower or
            "'eur' as currency" in sql_lower or
            "'try' as currency" in sql_lower
        )

        if not explicit_converted_label:
            return ValidationResult(is_valid=True)

        if "currency_rates" not in sql_lower:
            return ValidationResult(
                is_valid=False,
                error_code="UNSAFE_CURRENCY_CONVERSION",
                error_message="Converted currency analytics must join currency_rates dynamically",
                error_details={
                    "error_code": "UNSAFE_CURRENCY_CONVERSION",
                    "reason": "converted monetary result without currency_rates join",
                    "suggestion": (
                        "Join currency_rates once using the row currency "
                        "(for example currency_rates.target_currency = o.currency)."
                    ),
                },
            )

        hardcoded_rate_joins = re.findall(r"\bcurrency_rates\s+([a-zA-Z_][a-zA-Z0-9_]*)", sql, flags=re.IGNORECASE)
        suspicious_hardcoded_aliases = [
            alias for alias in hardcoded_rate_joins
            if re.fullmatch(r"cr_[a-z]{3,4}", alias.lower())
        ]
        if suspicious_hardcoded_aliases:
            return ValidationResult(
                is_valid=False,
                error_code="UNSAFE_CURRENCY_CONVERSION",
                error_message="Converted currency analytics must not hardcode per-currency rate joins",
                error_details={
                    "error_code": "UNSAFE_CURRENCY_CONVERSION",
                    "reason": "per-currency rate joins are brittle and can miss currencies",
                    "aliases": suspicious_hardcoded_aliases,
                    "suggestion": (
                        "Replace separate rate joins with one generic currency_rates join "
                        "keyed by the row currency."
                    ),
                },
            )

        raw_native_fallback = re.search(
            r"else\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?(subtotal|grand_total|amount|unit_price)\b",
            sql_lower,
        )
        if raw_native_fallback:
            return ValidationResult(
                is_valid=False,
                error_code="UNSAFE_CURRENCY_CONVERSION",
                error_message="Converted currency analytics cannot fall back to raw native monetary values",
                error_details={
                    "error_code": "UNSAFE_CURRENCY_CONVERSION",
                    "reason": "non-target currency rows would be mislabeled as converted currency",
                    "fallback_column": raw_native_fallback.group(1),
                    "suggestion": (
                        "Use the matching currency_rates rate for every non-target-currency row "
                        "or exclude rows without a rate."
                    ),
                },
            )

        generic_currency_join = re.search(
            r"target_currency\s*=\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?currency\b",
            sql_lower,
        )
        if not generic_currency_join:
            return ValidationResult(
                is_valid=False,
                error_code="UNSAFE_CURRENCY_CONVERSION",
                error_message="Converted currency analytics must join rates on the row currency column",
                error_details={
                    "error_code": "UNSAFE_CURRENCY_CONVERSION",
                    "reason": "currency_rates join is not keyed by the row currency",
                    "suggestion": (
                        "Join currency_rates on the source row currency column "
                        "(for example cr.target_currency = o.currency)."
                    ),
                },
            )

        return ValidationResult(is_valid=True)

    def _load_schema_policies(self) -> tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
        schema_path = Path(__file__).parent.parent / "schema" / "analytics_schema.json"
        try:
            with open(schema_path, "r", encoding="utf-8") as handle:
                schema = json.load(handle)
        except FileNotFoundError:
            return {}, {}

        column_policies = {
            key.lower(): value
            for key, value in schema.get("columnPolicies", {}).items()
        }
        table_metadata = {
            key.lower(): value
            for key, value in schema.get("tableMetadata", {}).items()
        }
        return column_policies, table_metadata

    def _check_unsafe_aggregations(self, sql: str) -> ValidationResult:
        cte_sources, main_sql = self._extract_cte_sources(sql)
        alias_sources = self._extract_alias_sources(main_sql, cte_sources)
        aggregate_refs = self._extract_aggregate_column_refs(main_sql)

        if not aggregate_refs:
            return ValidationResult(is_valid=True)

        tables_in_query: Set[str] = set()
        for base_tables in alias_sources.values():
            tables_in_query.update(base_tables)

        multi_fanout_result = self._check_multi_fanout_aggregation(aggregate_refs, alias_sources)
        if not multi_fanout_result.is_valid:
            return multi_fanout_result

        for aggregate_ref in aggregate_refs:
            aggregate_fn = aggregate_ref["function"]
            alias = aggregate_ref["alias"]
            column = aggregate_ref["column"]
            source_tables = alias_sources.get(alias, {alias})

            for source_table in source_tables:
                policy_key = f"{source_table}.{column}".lower()
                policy = self._column_policies.get(policy_key)
                if not policy:
                    continue

                semantic_type = str(policy.get("semantic_type", "unknown"))
                aggregation_safe = bool(policy.get("aggregation_safe", True))
                duplicated_by = self._find_fanout_duplication_source(source_table, tables_in_query)

                if aggregate_fn == "sum" and semantic_type in {"ratio_metric", "derived_metric"}:
                    return ValidationResult(
                        is_valid=False,
                        error_code="INVALID_AGGREGATION_FOR_SEMANTIC_TYPE",
                        error_message=(
                            f"{aggregate_fn.upper()} is not allowed for {source_table}.{column} "
                            f"({semantic_type})"
                        ),
                        error_details={
                            "error_code": "INVALID_AGGREGATION_FOR_SEMANTIC_TYPE",
                            "column": f"{source_table}.{column}",
                            "aggregate_function": aggregate_fn,
                            "semantic_type": semantic_type,
                            "suggestion": self._suggest_repair_for_semantic_type(source_table, column, semantic_type),
                        },
                    )

                if aggregate_fn == "avg" and semantic_type in {"snapshot_metric", "derived_metric"} and duplicated_by:
                    return ValidationResult(
                        is_valid=False,
                        error_code="AGGREGATION_DOUBLE_COUNT_RISK",
                        error_message=(
                            f"{aggregate_fn.upper()} on {source_table}.{column} is unsafe after joining "
                            f"fanout table {duplicated_by}"
                        ),
                        error_details={
                            "error_code": "AGGREGATION_DOUBLE_COUNT_RISK",
                            "column": f"{source_table}.{column}",
                            "aggregate_function": aggregate_fn,
                            "semantic_type": semantic_type,
                            "fanout_table": duplicated_by,
                            "join_path": [source_table, duplicated_by],
                            "reason": "column grain is duplicated before aggregation",
                            "suggestion": self._suggest_repair_for_semantic_type(source_table, column, semantic_type),
                        },
                    )

                if not aggregation_safe and duplicated_by:
                    return ValidationResult(
                        is_valid=False,
                        error_code="AGGREGATION_DOUBLE_COUNT_RISK",
                        error_message=(
                            f"{aggregate_fn.upper()} on {source_table}.{column} is unsafe after joining "
                            f"fanout table {duplicated_by}"
                        ),
                        error_details={
                            "error_code": "AGGREGATION_DOUBLE_COUNT_RISK",
                            "column": f"{source_table}.{column}",
                            "aggregate_function": aggregate_fn,
                            "semantic_type": semantic_type,
                            "fanout_table": duplicated_by,
                            "join_path": [source_table, duplicated_by],
                            "reason": "column grain is duplicated before aggregation",
                            "suggestion": self._suggest_repair_for_semantic_type(source_table, column, semantic_type),
                        },
                    )

        return ValidationResult(is_valid=True)

    def _check_multi_fanout_aggregation(
        self,
        aggregate_refs: List[Dict[str, str]],
        alias_sources: Dict[str, Set[str]],
    ) -> ValidationResult:
        fanout_tables_with_aggregates: Dict[str, Set[str]] = {}

        for aggregate_ref in aggregate_refs:
            alias = aggregate_ref["alias"]
            source_tables = alias_sources.get(alias, {alias})
            for source_table in source_tables:
                metadata = self._table_metadata.get(source_table.lower(), {})
                if metadata.get("joinBehavior") != "fanout":
                    continue
                duplicates = {
                    value.lower()
                    for value in metadata.get("duplicatesParentTables", [])
                }
                if not duplicates:
                    continue
                fanout_tables_with_aggregates.setdefault(source_table.lower(), set()).update(duplicates)

        fanout_tables = sorted(fanout_tables_with_aggregates.keys())
        if len(fanout_tables) < 2:
            return ValidationResult(is_valid=True)

        shared_parents = set.intersection(
            *(fanout_tables_with_aggregates[table] for table in fanout_tables)
        )
        if not shared_parents:
            return ValidationResult(is_valid=True)

        parent_table = sorted(shared_parents)[0]
        return ValidationResult(
            is_valid=False,
            error_code="MULTI_FANOUT_AGGREGATION_RISK",
            error_message=(
                f"Aggregating across multiple fanout tables ({', '.join(fanout_tables)}) "
                f"can duplicate {parent_table} rows"
            ),
            error_details={
                "error_code": "MULTI_FANOUT_AGGREGATION_RISK",
                "fanout_tables": fanout_tables,
                "parent_table": parent_table,
                "reason": "multiple fanout child tables are aggregated in the same SELECT scope",
                "suggestion": (
                    "Aggregate each fanout child table in its own CTE or subquery before joining "
                    "the results on the parent entity."
                ),
            },
        )

    def _suggest_repair_for_semantic_type(self, table: str, column: str, semantic_type: str) -> str:
        qualified = f"{table}.{column}"
        if semantic_type == "snapshot_metric":
            return f"Use {qualified} directly or MAX({qualified}) only if the grouping keeps one row per {table[:-1] if table.endswith('s') else table}."
        if semantic_type == "derived_metric":
            return f"Do not aggregate {qualified}; recompute from the source-of-truth child table instead."
        if semantic_type == "ratio_metric":
            return f"Do not SUM {qualified}; prefer AVG(...) from raw inputs or select the ratio column directly."
        return f"Review whether {qualified} should be aggregated or selected directly."

    def _find_fanout_duplication_source(self, source_table: str, tables_in_query: Set[str]) -> Optional[str]:
        normalized_source = source_table.lower()
        for table in tables_in_query:
            metadata = self._table_metadata.get(table.lower(), {})
            duplicates = {value.lower() for value in metadata.get("duplicatesParentTables", [])}
            if normalized_source in duplicates:
                return table.lower()
        return None

    def _extract_aggregate_column_refs(self, sql: str) -> List[Dict[str, str]]:
        matches = re.finditer(
            r"(?is)\b(sum|avg|min|max|count)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)",
            sql,
        )
        return [
            {
                "function": match.group(1).lower(),
                "alias": match.group(2).lower(),
                "column": match.group(3).lower(),
            }
            for match in matches
        ]

    def _extract_alias_sources(
        self,
        sql: str,
        cte_sources: Dict[str, Set[str]],
    ) -> Dict[str, Set[str]]:
        alias_sources: Dict[str, Set[str]] = {}
        pattern = re.compile(
            r"(?is)\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*)?"
        )
        keywords = {"where", "group", "order", "limit", "on", "inner", "left", "right", "full", "outer"}
        for match in pattern.finditer(sql):
            source_name = match.group(1).lower()
            alias_name = (match.group(2) or source_name).lower()
            if alias_name in keywords:
                alias_name = source_name
            base_sources = cte_sources.get(source_name, {source_name})
            alias_sources[alias_name] = set(base_sources)
            alias_sources.setdefault(source_name, set(base_sources))
        return alias_sources

    def _extract_cte_sources(self, sql: str) -> tuple[Dict[str, Set[str]], str]:
        stripped = sql.strip()
        if not stripped.lower().startswith("with "):
            return {}, sql

        cte_sources: Dict[str, Set[str]] = {}
        position = 4
        length = len(stripped)

        while position < length:
            while position < length and stripped[position].isspace():
                position += 1

            name_start = position
            while position < length and (stripped[position].isalnum() or stripped[position] == "_"):
                position += 1
            cte_name = stripped[name_start:position].lower()
            if not cte_name:
                break

            while position < length and stripped[position].isspace():
                position += 1

            if position < length and stripped[position] == "(":
                depth = 1
                position += 1
                while position < length and depth > 0:
                    if stripped[position] == "(":
                        depth += 1
                    elif stripped[position] == ")":
                        depth -= 1
                    position += 1
                while position < length and stripped[position].isspace():
                    position += 1

            if stripped[position:position + 2].lower() != "as":
                break
            position += 2

            while position < length and stripped[position].isspace():
                position += 1

            if position >= length or stripped[position] != "(":
                break

            depth = 0
            body_start = position + 1
            position += 1
            while position < length:
                if stripped[position] == "(":
                    depth += 1
                elif stripped[position] == ")":
                    if depth == 0:
                        break
                    depth -= 1
                position += 1
            body_sql = stripped[body_start:position]
            nested_ctes, nested_main = self._extract_cte_sources(body_sql)
            nested_aliases = self._extract_alias_sources(nested_main, nested_ctes)
            base_tables: Set[str] = set()
            for resolved_tables in nested_aliases.values():
                base_tables.update(resolved_tables)
            cte_sources[cte_name] = base_tables or {cte_name}

            position += 1
            while position < length and stripped[position].isspace():
                position += 1
            if position < length and stripped[position] == ",":
                position += 1
                continue
            break

        return cte_sources, stripped[position:].strip()

    def get_safe_sql(self, sql: str) -> str:
        """
        Get SQL with defaults applied (e.g., LIMIT if missing).
        Note: This doesn't validate, just applies defaults.
        """
        query = self._parser.parse(sql)
        if not query.has_limit:
            return sql + f" LIMIT {DEFAULT_LIMIT}"
        return sql


# Global instance
sql_validator = SQLValidator()


def validate(
    sql: str,
    role: str = "INDIVIDUAL",
    access_mode: str = "PERSONAL",
    require_scope_filter: bool = True
) -> ValidationResult:
    """Convenience function for SQL validation."""
    return sql_validator.validate(sql, role, access_mode, require_scope_filter)


def is_valid_sql(sql: str, role: str = "INDIVIDUAL") -> bool:
    """Quick check if SQL is valid."""
    return sql_validator.validate(sql, role).is_valid
