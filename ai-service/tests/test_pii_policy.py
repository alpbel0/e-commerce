"""Tests for PII Policy."""

import pytest
from app.services.pii_policy import (
    PIIPolicy,
    pii_policy,
    check_sensitive_columns,
    is_sensitive_column,
    SENSITIVE_COLUMNS,
)


class TestPIIPolicy:
    """Test suite for PII Policy."""

    def setup_method(self):
        self.policy = PIIPolicy()

    def test_sensitive_column_email(self):
        assert self.policy.is_sensitive_column("email") is True
        assert self.policy.is_sensitive_column("Email") is True
        assert self.policy.is_sensitive_column("EMAIL") is True

    def test_sensitive_column_password(self):
        assert self.policy.is_sensitive_column("password") is True
        assert self.policy.is_sensitive_column("password_hash") is True

    def test_sensitive_column_phone(self):
        assert self.policy.is_sensitive_column("phone") is True
        assert self.policy.is_sensitive_column("phone_number") is True

    def test_sensitive_column_address(self):
        assert self.policy.is_sensitive_column("address") is True

    def test_sensitive_column_token(self):
        assert self.policy.is_sensitive_column("token") is True
        assert self.policy.is_sensitive_column("refresh_token") is True

    def test_non_sensitive_column(self):
        assert self.policy.is_sensitive_column("product_name") is False
        assert self.policy.is_sensitive_column("order_id") is False
        assert self.policy.is_sensitive_column("price") is False
        assert self.policy.is_sensitive_column("quantity") is False

    def test_pii_table_users(self):
        assert self.policy.is_pii_table("users") is True

    def test_pii_table_non_pii(self):
        assert self.policy.is_pii_table("products") is False
        assert self.policy.is_pii_table("orders") is False

    def test_validate_columns_safe(self):
        columns = ["product_name", "price", "quantity"]
        is_safe, violating = self.policy.validate_columns(columns)
        assert is_safe is True
        assert len(violating) == 0

    def test_validate_columns_with_pii(self):
        columns = ["product_name", "email", "price"]
        is_safe, violating = self.policy.validate_columns(columns)
        assert is_safe is False
        assert "email" in violating

    def test_validate_columns_multiple_pii(self):
        columns = ["email", "phone", "address"]
        is_safe, violating = self.policy.validate_columns(columns)
        assert is_safe is False
        assert len(violating) == 3

    def test_check_query_pii_risk_safe(self):
        result = self.policy.check_query_pii_risk("select product_name from products", ["product_name"])
        assert result is None

    def test_check_query_pii_risk_email(self):
        result = self.policy.check_query_pii_risk("select email from users", ["email"])
        assert result is not None
        assert "email" in result

    def test_get_pii_rejection_message_turkish(self):
        msg = self.policy.get_pii_rejection_message("tr")
        assert "hassas" in msg.lower() or "musteri" in msg.lower()

    def test_get_pii_rejection_message_english(self):
        msg = self.policy.get_pii_rejection_message("en")
        assert "sensitive" in msg.lower() or "customer" in msg.lower()

    def test_get_credential_rejection_message_turkish(self):
        msg = self.policy.get_credential_rejection_message("tr")
        assert "guvenlik" in msg.lower() or "sifre" in msg.lower()

    def test_get_credential_rejection_message_english(self):
        msg = self.policy.get_credential_rejection_message("en")
        assert "security" in msg.lower() or "password" in msg.lower()


class TestGlobalFunctions:
    """Test module-level convenience functions."""

    def test_is_sensitive_column(self):
        assert is_sensitive_column("email") is True
        assert is_sensitive_column("password") is True
        assert is_sensitive_column("product_name") is False

    def test_check_sensitive_columns(self):
        is_safe, violating = check_sensitive_columns(["name", "email", "price"])
        assert is_safe is False
        assert "email" in violating


class TestSensitiveColumnsConstant:
    """Test SENSITIVE_COLUMNS constant."""

    def test_contains_expected_values(self):
        assert "email" in SENSITIVE_COLUMNS
        assert "password" in SENSITIVE_COLUMNS
        assert "phone" in SENSITIVE_COLUMNS
        assert "address" in SENSITIVE_COLUMNS
        assert "token" in SENSITIVE_COLUMNS

    def test_is_frozenset_or_set(self):
        assert isinstance(SENSITIVE_COLUMNS, (frozenset, set))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])