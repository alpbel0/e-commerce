package com.project.ecommerce.chatbot.service;

import com.project.ecommerce.auth.domain.RoleType;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class SqlSafetyValidator {

    private static final Set<String> ALLOWED_TABLES = Set.of(
        "users",
        "customer_profiles",
        "stores",
        "products",
        "categories",
        "orders",
        "order_items",
        "shipments",
        "reviews",
        "currency_rates",
        "payments",
        "payment_methods"
    );

    private static final Set<String> FORBIDDEN_KEYWORDS = Set.of(
        "insert",
        "update",
        "delete",
        "drop",
        "alter",
        "truncate",
        "create",
        "grant",
        "revoke",
        "copy",
        "call",
        "exec",
        "execute",
        "merge",
        "replace"
    );

    private static final Set<String> SENSITIVE_COLUMNS = Set.of(
        "password",
        "password_hash",
        "email",
        "contact_email",
        "phone",
        "phone_number",
        "contact_phone",
        "address",
        "owner_id",
        "customer_email",
        "customer_phone",
        "shipping_address_line1",
        "shipping_address_line2",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
        "shipping_country",
        "token",
        "refresh_token",
        "secret",
        "reset_token"
    );

    private static final Pattern TABLE_REFERENCE_PATTERN = Pattern.compile(
        "\\b(?:from|join)\\s+([a-zA-Z_][a-zA-Z0-9_\\.\\\"]*)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern LIMIT_PATTERN = Pattern.compile(
        "\\blimit\\s+(\\d+|:limit)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CTE_NAME_PATTERN = Pattern.compile(
        "(?is)^\\s*with\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s+as\\s*\\("
    );
    private static final Pattern CTE_NEXT_NAME_PATTERN = Pattern.compile(
        "(?is),\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s+as\\s*\\("
    );

    public void validate(String sql, RoleType role) {
        if (sql == null || sql.isBlank()) {
            throw new SqlValidationException("SQL_VALIDATION_FAILED: SQL is required");
        }

        String normalized = sql.strip();
        String lowerSql = normalized.toLowerCase(Locale.ROOT);
        Set<String> cteNames = extractCteNames(normalized);

        requireSelectOnly(lowerSql);
        rejectCommentsAndMultipleStatements(lowerSql);
        rejectForbiddenKeywords(lowerSql);
        rejectSelectStar(lowerSql);
        rejectSensitiveColumns(lowerSql);
        rejectUnknownTables(lowerSql, cteNames);
        requireRoleScope(sql, role);
    }

    public String enforceLimit(String sql) {
        return enforceLimit(sql, 500);
    }

    public String enforceLimit(String sql, int maxLimit) {
        String trimmed = sql.strip();
        Matcher limitMatcher = LIMIT_PATTERN.matcher(trimmed);
        if (limitMatcher.find()) {
            String limitValue = limitMatcher.group(1);
            if (":limit".equalsIgnoreCase(limitValue)) {
                return trimmed;
            }

            int explicitLimit = Integer.parseInt(limitValue);
            if (explicitLimit <= maxLimit) {
                return trimmed;
            }

            return limitMatcher.replaceFirst("LIMIT :limit");
        }

        if (containsWord(trimmed, "limit")) {
            throw new SqlValidationException("SQL_VALIDATION_FAILED: LIMIT must be numeric or :limit");
        }

        if (maxLimit <= 0) {
            return trimmed;
        }
        return trimmed + " LIMIT :limit";
    }

    private void requireSelectOnly(String lowerSql) {
        if (!lowerSql.startsWith("select ") && !lowerSql.startsWith("with ")) {
            throw new SqlValidationException("SQL_VALIDATION_FAILED: Only SELECT queries are allowed");
        }
    }

    private void rejectCommentsAndMultipleStatements(String lowerSql) {
        if (lowerSql.contains(";") || lowerSql.contains("--") || lowerSql.contains("/*") || lowerSql.contains("*/")) {
            throw new SqlValidationException("SQL_VALIDATION_FAILED: Comments and multiple statements are not allowed");
        }
    }

    private void rejectForbiddenKeywords(String lowerSql) {
        for (String keyword : FORBIDDEN_KEYWORDS) {
            if (containsWord(lowerSql, keyword)) {
                throw new SqlValidationException("SQL_VALIDATION_FAILED: Forbidden SQL keyword: " + keyword);
            }
        }
    }

    private void rejectSelectStar(String lowerSql) {
        if (Pattern.compile("\\bselect\\s+\\*", Pattern.CASE_INSENSITIVE).matcher(lowerSql).find()
            || Pattern.compile("\\b[a-zA-Z_][a-zA-Z0-9_]*\\.\\*", Pattern.CASE_INSENSITIVE).matcher(lowerSql).find()) {
            throw new SqlValidationException("SQL_VALIDATION_FAILED: SELECT * is not allowed");
        }
    }

    private void rejectSensitiveColumns(String lowerSql) {
        for (String column : SENSITIVE_COLUMNS) {
            if (containsWord(lowerSql, column)) {
                throw new SqlValidationException("PRIVACY_RISK: Sensitive column is not allowed: " + column);
            }
        }
    }

    private void rejectUnknownTables(String lowerSql, Set<String> cteNames) {
        Matcher matcher = TABLE_REFERENCE_PATTERN.matcher(lowerSql);
        while (matcher.find()) {
            String tableName = cleanTableName(matcher.group(1));
            if (cteNames.contains(tableName)) {
                continue;
            }
            if (!ALLOWED_TABLES.contains(tableName)) {
                throw new SqlValidationException("SQL_VALIDATION_FAILED: Table is not allowlisted: " + tableName);
            }
        }
    }

    private void requireRoleScope(String sql, RoleType role) {
        if (role == RoleType.CORPORATE && !sql.contains(":allowedStoreIds") && !sql.contains(":selectedStoreId")) {
            throw new SqlValidationException("SQL_SCOPE_VIOLATION: Corporate queries must include store scope");
        }
        if (role == RoleType.INDIVIDUAL && !sql.contains(":currentUserId")) {
            throw new SqlValidationException("SQL_SCOPE_VIOLATION: Individual queries must include current user scope");
        }
    }

    private boolean containsWord(String sql, String word) {
        return Pattern.compile("\\b" + Pattern.quote(word) + "\\b", Pattern.CASE_INSENSITIVE).matcher(sql).find();
    }

    private String cleanTableName(String rawTableName) {
        String tableName = rawTableName.replace("\"", "");
        int schemaSeparatorIndex = tableName.lastIndexOf('.');
        if (schemaSeparatorIndex >= 0) {
            tableName = tableName.substring(schemaSeparatorIndex + 1);
        }
        return tableName.toLowerCase(Locale.ROOT);
    }

    private Set<String> extractCteNames(String sql) {
        Set<String> cteNames = new HashSet<>();
        Matcher firstMatcher = CTE_NAME_PATTERN.matcher(sql);
        if (!firstMatcher.find()) {
            return cteNames;
        }
        cteNames.add(firstMatcher.group(1).toLowerCase(Locale.ROOT));

        Matcher nextMatcher = CTE_NEXT_NAME_PATTERN.matcher(sql);
        while (nextMatcher.find()) {
            cteNames.add(nextMatcher.group(1).toLowerCase(Locale.ROOT));
        }
        return cteNames;
    }

    public static class SqlValidationException extends RuntimeException {
        public SqlValidationException(String message) {
            super(message);
        }
    }
}
