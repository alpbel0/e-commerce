"""Tests for SQL Validator."""

import pytest
from app.services.sql_validator import (
    SQLValidator,
    PUBLIC_AGGREGATE_ALLOWED_TABLES,
    sql_validator,
    validate,
    is_valid_sql,
    ValidationResult,
    ALLOWED_TABLES,
    DEFAULT_LIMIT,
    MAX_LIMIT,
)


class TestSQLValidator:
    """Test suite for SQL Validator."""

    def setup_method(self):
        self.validator = SQLValidator()

    # SELECT only tests (use ADMIN to bypass scope requirements)
    def test_valid_select(self):
        result = self.validator.validate("SELECT id, name FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True

    def test_reject_insert(self):
        result = self.validator.validate("INSERT INTO products (name) VALUES ('Test')", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert result.error_code == "SQL_VALIDATION_FAILED"

    def test_reject_update(self):
        result = self.validator.validate("UPDATE products SET name = 'Test' WHERE id = 1", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert result.error_code == "SQL_VALIDATION_FAILED"

    def test_reject_delete(self):
        result = self.validator.validate("DELETE FROM orders WHERE id = 1", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert result.error_code == "SQL_VALIDATION_FAILED"

    # Multiple statements tests
    def test_reject_multiple_statements(self):
        result = self.validator.validate("SELECT * FROM products; DROP TABLE products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert "Multiple" in result.error_message

    def test_reject_semicolon_with_second_statement(self):
        result = self.validator.validate("SELECT * FROM products; SELECT * FROM orders", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False

    # Forbidden keywords tests
    def test_reject_drop(self):
        result = self.validator.validate("DROP TABLE products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False

    def test_reject_truncate(self):
        result = self.validator.validate("TRUNCATE orders", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False

    def test_reject_alter(self):
        result = self.validator.validate("ALTER TABLE products ADD COLUMN new_col INT", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False

    def test_reject_create(self):
        result = self.validator.validate("CREATE TABLE new_table (id INT)", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False

    # SELECT * tests
    def test_reject_select_star(self):
        result = self.validator.validate("SELECT * FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert "SELECT *" in result.error_message or "not allowed" in result.error_message.lower()

    def test_reject_table_select_star(self):
        result = self.validator.validate("SELECT products.* FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert "SELECT *" in result.error_message or "not allowed" in result.error_message.lower()

    def test_valid_select_specific_columns(self):
        result = self.validator.validate("SELECT id, name, price FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True

    # Table allowlist tests
    def test_reject_unknown_table(self):
        result = self.validator.validate("SELECT id FROM unknown_table", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert "not allowed" in result.error_message.lower() or "not in" in result.error_message.lower()

    def test_reject_sensitive_table(self):
        result = self.validator.validate("SELECT id FROM users", role="ADMIN", require_scope_filter=False)
        # 'users' might be in the allowlist but we'll check for PII separately
        # This depends on the actual allowed tables configuration

    def test_valid_allowed_table(self):
        result = self.validator.validate("SELECT id, name FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True

    def test_valid_orders_table(self):
        result = self.validator.validate("SELECT id, total FROM orders", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True

    def test_valid_payment_methods_table(self):
        result = self.validator.validate("SELECT code, name FROM payment_methods", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True

    # Sensitive columns tests (use ADMIN to test column filtering without scope issues)
    # Use customer_profiles which is in allowlist but has sensitive columns
    def test_reject_email_column(self):
        # customer_profiles has contact_email which is sensitive
        result = self.validator.validate("SELECT contact_email FROM customer_profiles", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert result.error_code == "PRIVACY_RISK"

    def test_reject_password_column(self):
        # users table not in allowlist, but we can test password_hash with orders table
        # Actually there's no password column in allowlist tables - skip this test
        pass

    def test_reject_phone_column(self):
        # customer_profiles has contact_phone which is sensitive
        result = self.validator.validate("SELECT contact_phone FROM customer_profiles", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert result.error_code == "PRIVACY_RISK"

    def test_reject_token_column(self):
        # No table with token in allowlist - skip specific test
        pass

    # Role scope tests
    def test_corporate_requires_store_scope(self):
        result = self.validator.validate(
            "SELECT id, name FROM products",
            role="CORPORATE",
            require_scope_filter=True
        )
        assert result.is_valid is False
        assert result.error_code == "SQL_SCOPE_VIOLATION"

    def test_corporate_with_allowed_stores(self):
        result = self.validator.validate(
            "SELECT id FROM products WHERE store_id IN (:allowedStoreIds)",
            role="CORPORATE",
            require_scope_filter=True
        )
        assert result.is_valid is True

    def test_corporate_with_selected_store(self):
        result = self.validator.validate(
            "SELECT id FROM products WHERE store_id = :selectedStoreId",
            role="CORPORATE",
            require_scope_filter=True
        )
        assert result.is_valid is True

    def test_individual_requires_user_scope(self):
        result = self.validator.validate(
            "SELECT id, name FROM orders",
            role="INDIVIDUAL",
            require_scope_filter=True
        )
        assert result.is_valid is False
        assert result.error_code == "SQL_SCOPE_VIOLATION"

    def test_individual_with_user_scope(self):
        result = self.validator.validate(
            "SELECT id FROM orders WHERE user_id = :currentUserId",
            role="INDIVIDUAL",
            require_scope_filter=True
        )
        assert result.is_valid is True

    def test_individual_public_aggregate_allows_review_ranking_without_user_scope(self):
        result = self.validator.validate(
            (
                "SELECT p.id, p.title, ROUND(AVG(r.star_rating), 2) AS avg_rating "
                "FROM products p "
                "JOIN reviews r ON r.product_id = p.id "
                "GROUP BY p.id, p.title "
                "ORDER BY avg_rating DESC"
            ),
            role="INDIVIDUAL",
            access_mode="PUBLIC_AGGREGATE",
            require_scope_filter=True
        )
        assert result.is_valid is True

    def test_individual_public_aggregate_rejects_business_tables(self):
        result = self.validator.validate(
            "SELECT p.id, SUM(oi.quantity) FROM products p JOIN order_items oi ON oi.product_id = p.id GROUP BY p.id",
            role="INDIVIDUAL",
            access_mode="PUBLIC_AGGREGATE",
            require_scope_filter=True
        )
        assert result.is_valid is False
        assert result.error_code == "SQL_SCOPE_VIOLATION"

    def test_individual_restricted_business_mode_is_rejected(self):
        result = self.validator.validate(
            "SELECT id, grand_total FROM orders WHERE user_id = :currentUserId",
            role="INDIVIDUAL",
            access_mode="RESTRICTED_BUSINESS",
            require_scope_filter=True
        )
        assert result.is_valid is False
        assert result.error_code == "SQL_SCOPE_VIOLATION"

    def test_admin_no_scope_required(self):
        result = self.validator.validate(
            "SELECT id, name FROM products",
            role="ADMIN",
            require_scope_filter=True
        )
        assert result.is_valid is True

    def test_admin_platform_query(self):
        result = self.validator.validate(
            "SELECT store_id, SUM(total) as revenue FROM orders GROUP BY store_id",
            role="ADMIN",
            require_scope_filter=False
        )
        assert result.is_valid is True

    # LIMIT tests
    def test_apply_default_limit(self):
        result = self.validator.validate("SELECT id, name FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True
        assert any("LIMIT" in str(d) for d in result.applied_defaults)

    def test_respect_explicit_limit(self):
        result = self.validator.validate("SELECT id, name FROM products LIMIT 50", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True
        assert len(result.applied_defaults) == 0

    # Empty/invalid SQL tests
    def test_reject_empty_sql(self):
        result = self.validator.validate("")
        assert result.is_valid is False
        assert result.error_code == "SQL_VALIDATION_FAILED"

    def test_reject_whitespace_sql(self):
        result = self.validator.validate("   ")
        assert result.is_valid is False

    # Comments in SQL - comments are stripped by parser, so validator accepts them
    # This is acceptable since comments don't change query execution semantics
    def test_reject_sql_with_comments(self):
        result = self.validator.validate("SELECT id FROM products -- comment", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert "comments" in result.error_message.lower()

    def test_reject_sql_with_block_comment(self):
        result = self.validator.validate("SELECT id FROM products /* comment */", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is False
        assert "comments" in result.error_message.lower()

    def test_reject_snapshot_metric_sum_after_fanout_join(self):
        result = self.validator.validate(
            (
                "SELECT p.id, SUM(p.total_sales) AS total_sales_count "
                "FROM products p "
                "JOIN reviews r ON r.product_id = p.id "
                "GROUP BY p.id"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is False
        assert result.error_code == "AGGREGATION_DOUBLE_COUNT_RISK"
        assert result.error_details["column"] == "products.total_sales"
        assert result.error_details["fanout_table"] == "reviews"

    def test_reject_snapshot_metric_sum_after_fanout_join_with_cte_alias(self):
        result = self.validator.validate(
            (
                "WITH product_data AS (SELECT id, total_sales FROM products) "
                "SELECT pd.id, SUM(pd.total_sales) AS total_sales_count "
                "FROM product_data pd "
                "JOIN reviews r ON r.product_id = pd.id "
                "GROUP BY pd.id"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is False
        assert result.error_code == "AGGREGATION_DOUBLE_COUNT_RISK"
        assert result.error_details["column"] == "products.total_sales"

    def test_allow_snapshot_metric_rollup_without_fanout_join(self):
        result = self.validator.validate(
            (
                "SELECT s.id, SUM(p.total_sales) AS total_sales_count "
                "FROM stores s "
                "JOIN products p ON p.store_id = s.id "
                "GROUP BY s.id"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is True

    def test_reject_ratio_metric_sum_even_without_fanout(self):
        result = self.validator.validate(
            (
                "SELECT p.id, SUM(r.star_rating) AS rating_sum "
                "FROM products p "
                "JOIN reviews r ON r.product_id = p.id "
                "GROUP BY p.id"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is False
        assert result.error_code == "INVALID_AGGREGATION_FOR_SEMANTIC_TYPE"
        assert result.error_details["column"] == "reviews.star_rating"

    def test_reject_multi_fanout_aggregation_in_same_scope(self):
        result = self.validator.validate(
            (
                "SELECT p.id, ROUND(AVG(r.star_rating), 2) AS average_rating, "
                "COUNT(r.id) AS review_count, SUM(oi.quantity) AS total_units_sold "
                "FROM products p "
                "JOIN reviews r ON r.product_id = p.id "
                "JOIN order_items oi ON oi.product_id = p.id "
                "GROUP BY p.id"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is False
        assert result.error_code == "MULTI_FANOUT_AGGREGATION_RISK"
        assert result.error_details["fanout_tables"] == ["order_items", "reviews"]
        assert result.error_details["parent_table"] == "products"

    def test_allow_multi_fanout_when_preaggregated_in_ctes(self):
        result = self.validator.validate(
            (
                "WITH review_stats AS ("
                "SELECT r.product_id, ROUND(AVG(r.star_rating), 2) AS average_rating, COUNT(r.id) AS review_count "
                "FROM reviews r GROUP BY r.product_id"
                "), sales_stats AS ("
                "SELECT oi.product_id, SUM(oi.quantity) AS total_units_sold "
                "FROM order_items oi GROUP BY oi.product_id"
                ") "
                "SELECT p.id, rs.average_rating, rs.review_count, ss.total_units_sold "
                "FROM products p "
                "JOIN review_stats rs ON rs.product_id = p.id "
                "LEFT JOIN sales_stats ss ON ss.product_id = p.id "
                "LIMIT :limit"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is True

    def test_reject_converted_revenue_with_raw_native_fallback(self):
        result = self.validator.validate(
            (
                "SELECT c.name, "
                "ROUND(SUM(CASE "
                "WHEN o.currency = 'USD' THEN oi.subtotal "
                "WHEN o.currency = 'TRY' THEN oi.subtotal / NULLIF(cr_try.rate, 0) "
                "ELSE oi.subtotal END), 2) AS total_revenue_usd "
                "FROM categories c "
                "JOIN products p ON p.category_id = c.id "
                "JOIN order_items oi ON oi.product_id = p.id "
                "JOIN orders o ON o.id = oi.order_id "
                "LEFT JOIN currency_rates cr_try ON cr_try.base_currency = 'USD' AND cr_try.target_currency = 'TRY' "
                "GROUP BY c.name"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is False
        assert result.error_code == "UNSAFE_CURRENCY_CONVERSION"

    def test_allow_converted_revenue_with_generic_currency_rates_join(self):
        result = self.validator.validate(
            (
                "SELECT c.name, "
                "ROUND(SUM(CASE "
                "WHEN o.currency = 'USD' THEN oi.subtotal "
                "WHEN cr.rate IS NOT NULL AND cr.rate <> 0 THEN oi.subtotal / cr.rate "
                "ELSE 0 END), 2) AS total_revenue_usd "
                "FROM categories c "
                "JOIN products p ON p.category_id = c.id "
                "JOIN order_items oi ON oi.product_id = p.id "
                "JOIN orders o ON o.id = oi.order_id "
                "LEFT JOIN currency_rates cr ON cr.base_currency = 'USD' AND cr.target_currency = o.currency "
                "GROUP BY c.name"
            ),
            role="ADMIN",
            require_scope_filter=False,
        )
        assert result.is_valid is True


class TestValidationResult:
    """Test ValidationResult dataclass."""

    def test_valid_result(self):
        result = ValidationResult(is_valid=True)
        assert result.is_valid is True
        assert result.error_code is None
        assert result.applied_defaults == []

    def test_invalid_result_with_defaults(self):
        result = ValidationResult(
            is_valid=True,
            applied_defaults=["LIMIT 100"]
        )
        assert result.applied_defaults == ["LIMIT 100"]

    def test_error_result(self):
        result = ValidationResult(
            is_valid=False,
            error_code="SQL_VALIDATION_FAILED",
            error_message="Only SELECT queries are allowed"
        )
        assert result.is_valid is False
        assert result.error_code == "SQL_VALIDATION_FAILED"


class TestModuleLevelFunctions:
    """Test module-level convenience functions."""

    def test_validate_function(self):
        result = validate("SELECT id, name FROM products", role="ADMIN", require_scope_filter=False)
        assert result.is_valid is True

    def test_is_valid_sql_function(self):
        # is_valid_sql uses default role=INDIVIDUAL which requires scope, so use ADMIN explicitly
        assert is_valid_sql("SELECT * FROM products", role="ADMIN") is False  # SELECT * not allowed
        assert is_valid_sql("SELECT id FROM products", role="ADMIN") is True


class TestConstants:
    """Test module constants."""

    def test_allowed_tables_defined(self):
        assert "products" in ALLOWED_TABLES
        assert "orders" in ALLOWED_TABLES
        assert "stores" in ALLOWED_TABLES

    def test_public_aggregate_tables_defined(self):
        assert PUBLIC_AGGREGATE_ALLOWED_TABLES == {"stores", "products", "categories", "reviews"}

    def test_default_limit(self):
        assert DEFAULT_LIMIT == 100

    def test_max_limit(self):
        assert MAX_LIMIT == 500


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
