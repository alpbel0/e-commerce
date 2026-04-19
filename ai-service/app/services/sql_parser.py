"""Lightweight SQL Parser for validation purposes."""

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Tuple
import re


class TokenType(Enum):
    KEYWORD = "KEYWORD"
    IDENTIFIER = "IDENTIFIER"
    OPERATOR = "OPERATOR"
    NUMBER = "NUMBER"
    STRING = "STRING"
    PUNCTUATION = "PUNCTUATION"
    EOF = "EOF"


@dataclass
class Token:
    type: TokenType
    value: str
    position: int


@dataclass
class SQLQuery:
    """Parsed SQL query structure."""
    sql_type: str  # SELECT, INSERT, UPDATE, DELETE, etc.
    tables: List[str]
    columns: List[str]
    where_columns: List[str]
    has_limit: bool
    limit_value: Optional[int]
    has_join: bool
    join_tables: List[str]
    raw_sql: str


class SQLParser:
    """Lightweight SQL tokenizer and parser."""

    SQL_KEYWORDS = {
        "select", "from", "where", "and", "or", "not", "in", "like", "between",
        "join", "inner", "left", "right", "outer", "on", "as",
        "group", "by", "having", "order", "asc", "desc",
        "limit", "offset", "union", "intersect", "except",
        "insert", "update", "delete", "drop", "alter", "create", "truncate",
        "grant", "revoke", "call", "execute", "merge", "replace",
    }

    # Keywords that indicate non-SELECT operations
    NON_SELECT_KEYWORDS = {
        "insert", "update", "delete", "drop", "alter", "create",
        "truncate", "grant", "revoke", "call", "execute", "merge", "replace",
    }

    def __init__(self):
        self._keywords = self.SQL_KEYWORDS
        self._non_select_keywords = self.NON_SELECT_KEYWORDS

    def tokenize(self, sql: str) -> List[Token]:
        """Tokenize SQL string into tokens."""
        tokens = []
        pos = 0
        sql_len = len(sql)

        while pos < sql_len:
            char = sql[pos]

            # Skip whitespace
            if char.isspace():
                pos += 1
                continue

            # String literals
            if char in ("'", '"'):
                token, new_pos = self._parse_string(sql, pos)
                tokens.append(token)
                pos = new_pos
                continue

            # Numbers
            if char.isdigit() or (char == '.' and pos + 1 < sql_len and sql[pos + 1].isdigit()):
                token, new_pos = self._parse_number(sql, pos)
                tokens.append(token)
                pos = new_pos
                continue

            # Identifiers and keywords
            if char.isalpha() or char == '_' or (char == '['):  # bracket quoted identifiers
                token, new_pos = self._parse_identifier(sql, pos)
                tokens.append(token)
                pos = new_pos
                continue

            # Comments (-- and /* */) - check BEFORE operators since - and / are operators
            if char == '-' and pos + 1 < sql_len and sql[pos + 1] == '-':
                # Skip to end of line
                while pos < sql_len and sql[pos] != '\n':
                    pos += 1
                continue
            if char == '/' and pos + 1 < sql_len and sql[pos + 1] == '*':
                # Skip until */
                pos += 2
                while pos + 1 < sql_len and not (sql[pos] == '*' and sql[pos + 1] == '/'):
                    pos += 1
                pos += 2  # skip the closing */
                continue

            # Operators
            if char in ('=', '>', '<', '!', '+', '-', '*', '/', '%'):
                token, new_pos = self._parse_operator(sql, pos)
                tokens.append(token)
                pos = new_pos
                continue

            # Punctuation
            if char in ('(', ')', ',', ';', '.'):
                tokens.append(Token(TokenType.PUNCTUATION, char, pos))
                pos += 1
                continue

            # Unknown character - skip
            pos += 1

        tokens.append(Token(TokenType.EOF, "", pos))
        return tokens

    def _parse_string(self, sql: str, pos: int) -> Tuple[Token, int]:
        """Parse string literal."""
        quote_char = sql[pos]
        start = pos
        pos += 1
        while pos < len(sql):
            if sql[pos] == quote_char:
                pos += 1
                # Handle escaped quotes
                if pos < len(sql) and sql[pos] == quote_char:
                    pos += 1
                    continue
                break
            pos += 1
        return Token(TokenType.STRING, sql[start:pos], start), pos

    def _parse_number(self, sql: str, pos: int) -> Tuple[Token, int]:
        """Parse number (integer or decimal)."""
        start = pos
        has_decimal = False
        while pos < len(sql):
            if sql[pos].isdigit():
                pos += 1
            elif sql[pos] == '.' and not has_decimal:
                has_decimal = True
                pos += 1
            else:
                break
        return Token(TokenType.NUMBER, sql[start:pos], start), pos

    def _parse_identifier(self, sql: str, pos: int) -> Tuple[Token, int]:
        """Parse identifier or keyword."""
        start = pos
        if sql[pos] == '[':  # bracket quoted
            pos += 1
            while pos < len(sql) and sql[pos] != ']':
                pos += 1
            pos += 1  # skip ]
            value = sql[start + 1:pos - 1]  # without brackets
        else:
            while pos < len(sql) and (sql[pos].isalnum() or sql[pos] in ('_', '.')):
                pos += 1
            value = sql[start:pos].lower()

        token_type = TokenType.KEYWORD if value in self._keywords else TokenType.IDENTIFIER
        return Token(token_type, value, start), pos

    def _parse_operator(self, sql: str, pos: int) -> Tuple[Token, int]:
        """Parse operator."""
        char = sql[pos]
        # Multi-char operators
        if pos + 1 < len(sql):
            two_char = sql[pos:pos + 2]
            if two_char in ('==', '!=', '<=', '>=', '->', '=>'):
                return Token(TokenType.OPERATOR, two_char, pos), pos + 2
            if two_char == '||':  # SQL Server concat
                return Token(TokenType.OPERATOR, '||', pos), pos + 2

        return Token(TokenType.OPERATOR, char, pos), pos + 1

    def parse(self, sql: str) -> SQLQuery:
        """Parse SQL string into structured query."""
        tokens = self.tokenize(sql)
        return self._build_query(tokens, sql)

    def _build_query(self, tokens: List[Token], raw_sql: str) -> SQLQuery:
        """Build SQLQuery from tokens."""
        if not tokens:
            return SQLQuery(
                sql_type="UNKNOWN",
                tables=[],
                columns=[],
                where_columns=[],
                has_limit=False,
                limit_value=None,
                has_join=False,
                join_tables=[],
                raw_sql=raw_sql,
            )

        first_keyword = tokens[0].value.lower() if tokens else ""
        sql_type = "SELECT"
        if first_keyword == "insert":
            sql_type = "INSERT"
        elif first_keyword == "update":
            sql_type = "UPDATE"
        elif first_keyword == "delete":
            sql_type = "DELETE"
        elif first_keyword == "drop":
            sql_type = "DROP"
        elif first_keyword == "truncate":
            sql_type = "TRUNCATE"
        elif first_keyword == "alter":
            sql_type = "ALTER"
        elif first_keyword == "create":
            sql_type = "CREATE"

        tables = []
        columns = []
        where_columns = []
        join_tables = []
        has_limit = False
        limit_value = None
        has_join = False

        i = 0
        while i < len(tokens):
            token = tokens[i]

            if token.type == TokenType.KEYWORD:
                keyword = token.value.lower()

                if keyword == "from":
                    # Get table name
                    if i + 1 < len(tokens) and tokens[i + 1].type == TokenType.IDENTIFIER:
                        tables.append(tokens[i + 1].value)
                    elif i + 1 < len(tokens) and tokens[i + 1].type == TokenType.PUNCTUATION and tokens[i + 1].value == '(':
                        # Subquery or function - skip
                        pass

                elif keyword in ("select", "where", "and", "or"):
                    # Look ahead for column names
                    j = i + 1
                    while j < len(tokens):
                        t = tokens[j]
                        if t.type == TokenType.IDENTIFIER:
                            col = t.value
                            # Skip table.column format
                            if j + 1 < len(tokens) and tokens[j + 1].value == '.':
                                j += 2
                                if j < len(tokens) and tokens[j].type == TokenType.IDENTIFIER:
                                    col = tokens[j].value
                            if keyword == "select" or (keyword == "where" and token.value == "where"):
                                if col not in columns:
                                    if keyword == "select":
                                        columns.append(col)
                                    else:
                                        where_columns.append(col)
                        elif t.type == TokenType.OPERATOR and t.value == '*':
                            # SELECT * - add * as a column marker
                            if keyword == "select" and '*' not in columns:
                                columns.append('*')
                        elif t.value == ',':
                            pass
                        elif t.type == TokenType.KEYWORD and t.value in ("from", "where", "group", "order", "limit"):
                            break
                        elif t.value == ')':
                            break
                        j += 1

                elif keyword in ("join", "inner", "left", "right", "outer"):
                    has_join = True
                    if keyword in ("join", "inner"):
                        if i + 1 < len(tokens) and tokens[i + 1].type == TokenType.IDENTIFIER:
                            join_tables.append(tokens[i + 1].value)

                elif keyword == "limit":
                    has_limit = True
                    # Get limit value
                    if i + 1 < len(tokens) and tokens[i + 1].type == TokenType.NUMBER:
                        try:
                            limit_value = int(tokens[i + 1].value)
                        except ValueError:
                            pass

                elif keyword == "group":
                    if i + 1 < len(tokens) and tokens[i + 1].value == "by":
                        # Group by columns
                        j = i + 2
                        while j < len(tokens):
                            t = tokens[j]
                            if t.type == TokenType.IDENTIFIER:
                                if t.value not in columns:
                                    columns.append(t.value)
                            elif t.type == TokenType.KEYWORD and t.value not in ("asc", "desc",):
                                break
                            j += 1

            i += 1

        return SQLQuery(
            sql_type=sql_type,
            tables=tables,
            columns=columns,
            where_columns=where_columns,
            has_limit=has_limit,
            limit_value=limit_value,
            has_join=has_join,
            join_tables=join_tables,
            raw_sql=raw_sql,
        )

    def is_select_only(self, sql: str) -> bool:
        """Check if SQL is a SELECT statement."""
        tokens = self.tokenize(sql)
        if not tokens:
            return False
        first = tokens[0].value.lower()
        return first == "select"

    def is_safe_sql(self, sql: str) -> tuple[bool, Optional[str]]:
        """
        Check if SQL is safe (basic safety check).

        Returns (is_safe, error_message)
        """
        if not sql or sql.isspace():
            return False, "Empty SQL"

        sql_lower = sql.lower().strip()

        # Check for multiple statements
        if ';' in sql:
            # Check if it's after the main query (not in string)
            parts = sql.split(';')
            main_query = parts[0].strip().lower()
            if main_query and not main_query.startswith("select"):
                return False, "Only SELECT statements are allowed"
            if len(parts) > 1 and parts[1].strip():
                return False, "Multiple statements not allowed"

        # Check for comments
        if '--' in sql_lower or '/*' in sql_lower:
            return False, "Comments not allowed"

        return True, None

    def get_tables(self, sql: str) -> List[str]:
        """Extract table names from SQL."""
        query = self.parse(sql)
        return query.tables + query.join_tables

    def get_columns(self, sql: str) -> List[str]:
        """Extract column names from SELECT clause."""
        query = self.parse(sql)
        return query.columns


# Global instance
sql_parser = SQLParser()


def tokenize(sql: str) -> List[Token]:
    """Convenience function for tokenization."""
    return sql_parser.tokenize(sql)


def parse(sql: str) -> SQLQuery:
    """Convenience function for parsing."""
    return sql_parser.parse(sql)


def is_select_only(sql: str) -> bool:
    """Convenience function to check if SQL is SELECT."""
    return sql_parser.is_select_only(sql)