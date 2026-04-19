"""Schema context builder for LLM prompt injection."""

from app.schemas.chat import RoleType


def build_schema_context(
    schema: dict,
    role: RoleType,
    language: str = "en"
) -> str:
    """
    Build a human-readable schema context string for LLM prompt injection.

    The schema prompt is intentionally always English. Answer language is handled
    by the analysis agent, not by the SQL/schema prompt.
    """
    tables = schema.get("tables", [])
    relationships = schema.get("relationships", [])
    role_rules = schema.get("roleRules", {})
    table_metadata = schema.get("tableMetadata", {})
    column_policies = schema.get("columnPolicies", {})

    if role == RoleType.ADMIN:
        accessible_table_names = set(role_rules.get("adminAccessibleTables", []))
    elif role == RoleType.CORPORATE:
        accessible_table_names = set(role_rules.get("corporateAccessibleTables", []))
    else:
        accessible_table_names = set(role_rules.get("individualAccessibleTables", []))

    sensitive_columns = set(role_rules.get("sensitiveColumns", []))
    pii_columns = set(role_rules.get("piiColumns", []))

    lines = [
        "## ANALYTICS SCHEMA (Available Database Structure)",
        "",
        "The following tables and columns exist in the database.",
        f"User role: {role.value}",
        "",
        "### TABLES:",
        "",
    ]

    for table in tables:
        table_name = table.get("tableName", "")
        if table_name not in accessible_table_names:
            continue

        lines.append(f"**{table_name}** - {table.get('description', '')}")
        lines.append("")

        for column in table.get("columns", []):
            column_name = column.get("name", "")
            data_type = column.get("dataType", "")
            description = column.get("description", "")
            is_sensitive = column_name.lower() in sensitive_columns or column_name.lower() in pii_columns
            sensitive_marker = " [SENSITIVE]" if is_sensitive else ""
            lines.append(f"  - {column_name} ({data_type}): {description}{sensitive_marker}")

        lines.append("")

    lines.append("### RELATIONSHIPS (JOIN Paths):")
    lines.append("")

    relationship_lines = []
    for relationship in relationships:
        from_table = relationship.get("fromTable", "")
        from_column = relationship.get("fromColumn", "")
        to_table = relationship.get("toTable", "")
        to_column = relationship.get("toColumn", "")
        relationship_type = relationship.get("relationshipType", "")

        if from_table in accessible_table_names and to_table in accessible_table_names:
            relationship_lines.append(
                f"  - {from_table}.{from_column} -> {to_table}.{to_column} ({relationship_type})"
            )

    lines.extend(relationship_lines if relationship_lines else ["  (no relationships available)"])
    lines.append("")

    if column_policies:
        lines.append("### AGGREGATION SEMANTICS:")
        lines.append("")
        for column_name, policy in sorted(column_policies.items()):
            semantic_type = policy.get("semantic_type", "unknown")
            aggregation_safe = policy.get("aggregation_safe", True)
            lines.append(
                f"  - {column_name}: semantic_type={semantic_type}, aggregation_safe={aggregation_safe}"
            )
        lines.append("")

    if table_metadata:
        lines.append("### JOIN BEHAVIOR:")
        lines.append("")
        for table_name, metadata in sorted(table_metadata.items()):
            join_behavior = metadata.get("joinBehavior", "unknown")
            duplicates = ", ".join(metadata.get("duplicatesParentTables", [])) or "none"
            lines.append(
                f"  - {table_name}: join_behavior={join_behavior}, duplicates_parent_tables={duplicates}"
            )
        lines.append("")

    lines.append("### ROLE-SPECIFIC RULES:")
    lines.append("")
    if role == RoleType.ADMIN:
        lines.append("- You can access all analytics tables.")
        lines.append("- PII and sensitive columns are forbidden: email, password_hash, phone, address, token, secret, and similar fields.")
        lines.append("- Only generate SELECT queries.")
    elif role == RoleType.CORPORATE:
        lines.append("- You can only access data from stores owned by the current corporate user.")
        lines.append("- SQL MUST use ':allowedStoreIds' or ':selectedStoreId' placeholders for store-scoped data.")
        lines.append("- PII columns are forbidden: customer_email, customer_phone, address, shipping address fields, and similar fields.")
        lines.append("- Never access data from stores outside the allowed store scope.")
    else:
        lines.append("- You can only access the current user's own orders, reviews, shipments, and aggregate profile data.")
        lines.append("- SQL MUST use the ':currentUserId' placeholder for user-scoped data.")
        lines.append("- Never access another user's raw data.")

    lines.append("")
    lines.append("### IMPORTANT NOTES:")
    lines.append("")
    lines.append("- All primary keys and foreign keys use UUID values unless explicitly documented otherwise.")
    lines.append("- Date/time values use TIMESTAMP format: 'YYYY-MM-DD HH:MI:SS'.")
    lines.append("- Monetary values use DECIMAL columns.")
    lines.append("- Use IS NULL / IS NOT NULL for null checks.")
    lines.append("- SELECT * is forbidden. Select only the columns needed for the answer.")
    lines.append("- Respect schema annotations such as semantic_type, aggregation_safe, and join_behavior.")

    return "\n".join(lines)


def get_role_access_summary(role: RoleType) -> dict:
    """
    Get a compact summary of role access for system prompts.

    Returns:
        Dict with tables, required_placeholders, and forbidden_columns
    """
    if role == RoleType.ADMIN:
        return {
            "scope": "PLATFORM_WIDE",
            "tables": ["stores", "products", "categories", "orders", "order_items", "shipments", "reviews", "customer_profiles", "currency_rates", "payments", "payment_methods"],
            "required_placeholders": [],
            "forbidden_columns": ["password", "password_hash", "email", "phone", "address", "token", "secret", "owner_id", "customer_email", "customer_phone", "shipping_address_*"]
        }
    if role == RoleType.CORPORATE:
        return {
            "scope": "OWNED_STORES",
            "tables": ["stores", "products", "categories", "orders", "order_items", "shipments", "reviews", "customer_profiles", "currency_rates", "payments", "payment_methods"],
            "required_placeholders": [":allowedStoreIds", ":selectedStoreId"],
            "forbidden_columns": ["password", "password_hash", "email", "phone", "address", "token", "secret", "owner_id", "customer_email", "customer_phone", "shipping_address_*"]
        }
    return {
        "scope": "OWN_DATA_ONLY",
        "tables": ["orders", "order_items", "shipments", "reviews", "customer_profiles", "products", "categories"],
        "required_placeholders": [":currentUserId"],
        "forbidden_columns": ["password", "password_hash", "email", "phone", "address", "token", "secret"]
    }
