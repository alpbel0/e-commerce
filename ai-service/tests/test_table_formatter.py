"""Tests for table_formatter.py."""

from app.services.table_formatter import (
    _format_currency,
    _format_datetime,
    _format_generic,
    _format_long_text,
    _is_currency_column,
    _is_datetime_column,
    _is_long_text_column,
    _to_label,
    format_table_from_data,
    format_table_response,
)


class TestColumnLabelMapping:
    def test_simple_snake_case(self):
        assert _to_label("product_name") == "Product Name"
        assert _to_label("order_date") == "Order Date"
        assert _to_label("grand_total") == "Grand Total"

    def test_special_cases(self):
        assert _to_label("id") == "ID"
        assert _to_label("uuid") == "UUID"
        assert _to_label("url") == "URL"
        assert _to_label("sku") == "SKU"


class TestCurrencyDetection:
    def test_schema_type_decimal(self):
        assert _is_currency_column("anything", "DECIMAL") is True
        assert _is_currency_column("anything", "NUMERIC") is True

    def test_schema_type_non_currency(self):
        assert _is_currency_column("anything", "VARCHAR") is False
        assert _is_currency_column("anything", "INTEGER") is False

    def test_name_pattern_price(self):
        assert _is_currency_column("unit_price", "VARCHAR") is True
        assert _is_currency_column("discount_price", "VARCHAR") is True


class TestDatetimeDetection:
    def test_schema_type_timestamp(self):
        assert _is_datetime_column("anything", "TIMESTAMP") is True
        assert _is_datetime_column("anything", "DATE") is True

    def test_name_pattern_date(self):
        assert _is_datetime_column("order_date", "VARCHAR") is True
        assert _is_datetime_column("delivery_date", "VARCHAR") is True


class TestLongTextDetection:
    def test_schema_type_text(self):
        assert _is_long_text_column("anything", "TEXT") is True

    def test_schema_type_varchar_long(self):
        assert _is_long_text_column("anything", "VARCHAR(500)") is True

    def test_name_pattern_description(self):
        assert _is_long_text_column("product_description", "VARCHAR") is True


class TestValueFormatting:
    def test_format_currency(self):
        assert _format_currency(1234.56) == "1,234.56"
        assert _format_currency(0) == "0.00"
        assert _format_currency(None) == "-"

    def test_format_datetime(self):
        assert _format_datetime("2024-01-15 14:30:00") == "2024-01-15 14:30"
        assert _format_datetime(None) == "-"

    def test_format_long_text(self):
        text = "A" * 100
        result = _format_long_text(text, limit=80)
        assert len(result) == 83
        assert result.endswith("...")
        assert _format_long_text(None, limit=80) == "-"

    def test_format_generic(self):
        assert _format_generic(123) == "123"
        assert _format_generic(None) == "-"


class TestFormatTableResponse:
    def test_basic_table(self):
        query_result = {
            "columns": ["product_name", "quantity", "unit_price"],
            "rows": [["Widget", 10, 29.99], ["Gadget", 5, 49.99]],
        }
        column_metadata = [
            {"name": "product_name", "dataType": "VARCHAR(255)", "isPII": False, "tableName": "products"},
            {"name": "quantity", "dataType": "INTEGER", "isPII": False, "tableName": "order_items"},
            {"name": "unit_price", "dataType": "DECIMAL(10,2)", "isPII": False, "tableName": "order_items"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.columns == ["Product Name", "Quantity", "Unit Price"]
        assert result.rows[0][2] == "29.99"
        assert result.rows[1][2] == "49.99"

    def test_currency_code_is_appended_when_explicit_column_exists(self):
        query_result = {
            "columns": ["title", "total_revenue", "currency"],
            "rows": [["Widget", 300.0, "USD"]],
        }
        column_metadata = [
            {"name": "title", "dataType": "VARCHAR(255)", "isPII": False, "tableName": "products"},
            {"name": "total_revenue", "dataType": "DECIMAL(10,2)", "isPII": False, "tableName": "orders"},
            {"name": "currency", "dataType": "VARCHAR(3)", "isPII": False, "tableName": "orders"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.rows[0][1] == "300.00 USD"
        assert result.rows[0][2] == "USD"

    def test_currency_is_not_invented_when_missing(self):
        query_result = {
            "columns": ["title", "total_revenue"],
            "rows": [["Widget", 300.0]],
        }
        column_metadata = [
            {"name": "title", "dataType": "VARCHAR(255)", "isPII": False, "tableName": "products"},
            {"name": "total_revenue", "dataType": "DECIMAL(10,2)", "isPII": False, "tableName": "orders"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.rows[0][1] == "300.00"

    def test_datetime_column_formatted(self):
        query_result = {
            "columns": ["order_date", "grand_total"],
            "rows": [["2024-01-15 10:00:00", 150.00]],
        }
        column_metadata = [
            {"name": "order_date", "dataType": "TIMESTAMP", "isPII": False, "tableName": "orders"},
            {"name": "grand_total", "dataType": "DECIMAL(12,2)", "isPII": False, "tableName": "orders"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.rows[0][0] == "2024-01-15 10:00"

    def test_null_values_become_dash(self):
        query_result = {
            "columns": ["product_name", "discount"],
            "rows": [["Widget", None]],
        }
        column_metadata = [
            {"name": "product_name", "dataType": "VARCHAR(255)", "isPII": False, "tableName": "products"},
            {"name": "discount", "dataType": "DECIMAL(5,2)", "isPII": False, "tableName": "products"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.rows[0][1] == "-"

    def test_long_text_truncated(self):
        query_result = {"columns": ["description"], "rows": [["A" * 200]]}
        column_metadata = [
            {"name": "description", "dataType": "TEXT", "isPII": False, "tableName": "products"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.rows[0][0].endswith("...")

    def test_pii_columns_removed(self):
        query_result = {
            "columns": ["email", "product_name", "phone"],
            "rows": [["test@example.com", "Widget", "555-1234"]],
        }
        column_metadata = [
            {"name": "email", "dataType": "VARCHAR(255)", "isPII": True, "tableName": "users"},
            {"name": "product_name", "dataType": "VARCHAR(255)", "isPII": False, "tableName": "products"},
            {"name": "phone", "dataType": "VARCHAR(50)", "isPII": True, "tableName": "users"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.columns == ["Product Name"]

    def test_truncated_flag_when_at_limit(self):
        query_result = {"columns": ["id"], "rows": [[i] for i in range(500)]}
        column_metadata = [
            {"name": "id", "dataType": "UUID", "isPII": False, "tableName": "orders"},
        ]

        result = format_table_response(query_result, column_metadata, "en", 500)
        assert result.truncated is True

    def test_empty_result(self):
        result = format_table_response({"columns": [], "rows": []}, [], "en", 500)
        assert result.columns == []
        assert result.row_count == 0


class TestFormatTableFromData:
    def test_dict_data_conversion(self):
        data = [
            {"product_name": "Widget", "quantity": 10},
            {"product_name": "Gadget", "quantity": 5},
        ]
        column_metadata = [
            {"name": "product_name", "dataType": "VARCHAR(255)", "isPII": False, "tableName": "products"},
            {"name": "quantity", "dataType": "INTEGER", "isPII": False, "tableName": "order_items"},
        ]

        result = format_table_from_data(data, column_metadata, "en", 500)
        assert result.row_count == 2
        assert "Product Name" in result.columns

    def test_empty_data(self):
        result = format_table_from_data([], [], "en", 500)
        assert result.row_count == 0
        assert result.columns == []
