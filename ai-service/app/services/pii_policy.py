"""PII (Personally Identifiable Information) Policy enforcement."""

from typing import Set, Optional


# Sensitive columns that should never be exposed
SENSITIVE_COLUMNS: Set[str] = {
    "email",
    "contact_email",
    "password",
    "password_hash",
    "phone",
    "phone_number",
    "contact_phone",
    "address",
    "customer_email",
    "customer_phone",
    "shipping_address_line1",
    "shipping_address_line2",
    "shipping_city",
    "shipping_state",
    "shipping_postal_code",
    "shipping_country",
    "owner_id",
    "token",
    "refresh_token",
    "reset_token",
    "secret",
    "api_key",
    "secret_key",
    "private_key",
}


# Tables that contain PII and should be treated with extra caution
PII_CONTAINING_TABLES: Set[str] = {
    "users",
    "customer_profiles",
    "addresses",
    "payment_methods",
}


class PIIPolicy:
    """Enforces PII protection policies."""

    def __init__(self):
        self._sensitive_columns = SENSITIVE_COLUMNS
        self._pii_tables = PII_CONTAINING_TABLES

    def is_sensitive_column(self, column_name: str) -> bool:
        """Check if a column is sensitive (PII)."""
        col_lower = column_name.lower().strip()
        return col_lower in self._sensitive_columns

    def is_pii_table(self, table_name: str) -> bool:
        """Check if table typically contains PII."""
        table_lower = table_name.lower().strip()
        return table_lower in self._pii_tables

    def check_query_pii_risk(self, sql_lower: str, selected_columns: list[str]) -> Optional[str]:
        """
        Check if query has PII risk.

        Returns None if safe, or a rejection reason string if risky.
        """
        # Check for sensitive columns in SELECT
        for col in selected_columns:
            if self.is_sensitive_column(col):
                return f"SENSITIVE_COLUMN: {col} is not allowed"

        return None

    def validate_columns(self, columns: list[str]) -> tuple[bool, list[str]]:
        """
        Validate that columns don't contain PII.

        Returns (is_safe, violating_columns)
        """
        violating = [col for col in columns if self.is_sensitive_column(col)]
        return (len(violating) == 0, violating)

    def get_pii_rejection_message(self, language: str = "tr") -> str:
        """Get a user-friendly rejection message for PII requests."""
        if language == "tr":
            return (
                "Istediginiz bilgi hassas musteri verileri iceriyor. "
                "Musteri sayisi, sehir dagilimi, segment analizi veya "
                "ortalama harcama gibi aggregate bilgiler sunabilirim."
            )
        return (
            "The information you requested contains sensitive customer data. "
            "I can provide aggregate metrics like customer count, city distribution, "
            "segment analysis, or average spending."
        )

    def get_credential_rejection_message(self, language: str = "tr") -> str:
        """Get rejection message for credential/token requests."""
        if language == "tr":
            return (
                "Guvenlik nedeniyle sifre, token veya kimlik bilgisi gösteremem. "
                "Bu tur bilgiler sistem guvenligi icin saklanir."
            )
        return (
            "For security reasons, I cannot show passwords, tokens, or credentials. "
            "This type of information is stored securely for system integrity."
        )


# Global instance
pii_policy = PIIPolicy()


def check_sensitive_columns(columns: list[str]) -> tuple[bool, list[str]]:
    """Convenience function to check for sensitive columns."""
    return pii_policy.validate_columns(columns)


def is_sensitive_column(column: str) -> bool:
    """Convenience function to check if a single column is sensitive."""
    return pii_policy.is_sensitive_column(column)
