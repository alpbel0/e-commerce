"""Tests for SQL Parser."""

import pytest
from app.services.sql_parser import (
    SQLParser,
    sql_parser,
    Token,
    TokenType,
    SQLQuery,
    tokenize,
    parse,
    is_select_only,
)


class TestSQLParser:
    """Test suite for SQL Parser."""

    def setup_method(self):
        self.parser = SQLParser()

    def test_tokenize_simple_select(self):
        tokens = self.parser.tokenize("SELECT id, name FROM products")
        assert len(tokens) >= 4
        assert tokens[0].value == "select"
        assert tokens[0].type == TokenType.KEYWORD

    def test_tokenize_with_limit(self):
        tokens = self.parser.tokenize("SELECT * FROM orders LIMIT 10")
        assert any(t.value == "limit" for t in tokens)
        assert any(t.value == "10" for t in tokens)

    def test_tokenize_string_literal(self):
        tokens = self.parser.tokenize("SELECT * FROM products WHERE name = 'Test Product'")
        assert any(t.type == TokenType.STRING for t in tokens)

    def test_tokenize_comments_stripped(self):
        tokens = self.parser.tokenize("SELECT id -- comment\nFROM products")
        # Comments should be stripped
        values = [t.value for t in tokens if t.type != TokenType.EOF]
        assert '--' not in values
        assert 'comment' not in values

    def test_tokenize_multiline_comment(self):
        tokens = self.parser.tokenize("SELECT id /* comment */ FROM products")
        values = [t.value for t in tokens if t.type != TokenType.EOF]
        assert 'comment' not in values

    def test_parse_select_query(self):
        query = self.parser.parse("SELECT id, name FROM products")
        assert query.sql_type == "SELECT"
        assert "products" in query.tables
        assert "id" in query.columns
        assert "name" in query.columns

    def test_parse_select_star_rejected(self):
        query = self.parser.parse("SELECT * FROM products")
        assert "*" in query.columns

    def test_parse_with_where(self):
        query = self.parser.parse("SELECT id FROM orders WHERE store_id = 1")
        assert "store_id" in query.where_columns

    def test_parse_with_join(self):
        query = self.parser.parse("SELECT * FROM orders JOIN products ON orders.product_id = products.id")
        assert query.has_join is True

    def test_parse_with_limit(self):
        query = self.parser.parse("SELECT id FROM products LIMIT 50")
        assert query.has_limit is True
        assert query.limit_value == 50

    def test_parse_insert_rejected(self):
        query = self.parser.parse("INSERT INTO products (name) VALUES ('Test')")
        assert query.sql_type == "INSERT"

    def test_parse_delete_rejected(self):
        query = self.parser.parse("DELETE FROM orders WHERE id = 1")
        assert query.sql_type == "DELETE"

    def test_parse_drop_rejected(self):
        query = self.parser.parse("DROP TABLE orders")
        assert query.sql_type == "DROP"

    def test_is_select_only_valid(self):
        assert self.parser.is_select_only("SELECT id FROM products") is True

    def test_is_select_only_invalid(self):
        assert self.parser.is_select_only("INSERT INTO products VALUES (1)") is False
        assert self.parser.is_select_only("DELETE FROM orders") is False

    def test_is_safe_sql_empty(self):
        is_safe, error = self.parser.is_safe_sql("")
        assert is_safe is False

    def test_is_safe_sql_multiple_statements(self):
        is_safe, error = self.parser.is_safe_sql("SELECT * FROM products; DROP TABLE products")
        assert is_safe is False
        assert "Multiple" in error

    def test_is_safe_sql_with_comments(self):
        is_safe, error = self.parser.is_safe_sql("SELECT * FROM products -- comment")
        assert is_safe is False
        assert "Comments" in error

    def test_is_safe_sql_valid(self):
        is_safe, error = self.parser.is_safe_sql("SELECT id, name FROM products")
        assert is_safe is True
        assert error is None

    def test_get_tables(self):
        tables = self.parser.get_tables("SELECT * FROM orders JOIN products ON orders.product_id = products.id")
        assert "orders" in tables
        assert "products" in tables

    def test_get_columns(self):
        columns = self.parser.get_columns("SELECT id, name, price FROM products")
        assert "id" in columns
        assert "name" in columns
        assert "price" in columns


class TestTokenTypes:
    """Test TokenType enum."""

    def test_token_types_exist(self):
        assert TokenType.KEYWORD is not None
        assert TokenType.IDENTIFIER is not None
        assert TokenType.OPERATOR is not None
        assert TokenType.NUMBER is not None
        assert TokenType.STRING is not None
        assert TokenType.PUNCTUATION is not None


class TestSQLQuery:
    """Test SQLQuery dataclass."""

    def test_sql_query_creation(self):
        query = SQLQuery(
            sql_type="SELECT",
            tables=["products"],
            columns=["id", "name"],
            where_columns=[],
            has_limit=False,
            limit_value=None,
            has_join=False,
            join_tables=[],
            raw_sql="SELECT id, name FROM products",
        )
        assert query.sql_type == "SELECT"
        assert query.tables == ["products"]
        assert query.columns == ["id", "name"]


class TestModuleLevelFunctions:
    """Test module-level convenience functions."""

    def test_tokenize_function(self):
        tokens = tokenize("SELECT id FROM products")
        assert len(tokens) > 0

    def test_parse_function(self):
        query = parse("SELECT * FROM orders LIMIT 10")
        assert query.sql_type == "SELECT"
        assert query.has_limit is True

    def test_is_select_only_function(self):
        assert is_select_only("SELECT id FROM products") is True
        assert is_select_only("DROP TABLE products") is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])