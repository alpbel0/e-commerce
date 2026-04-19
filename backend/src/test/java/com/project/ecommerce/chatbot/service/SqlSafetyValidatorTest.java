package com.project.ecommerce.chatbot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.project.ecommerce.auth.domain.RoleType;
import org.junit.jupiter.api.Test;

class SqlSafetyValidatorTest {

    private final SqlSafetyValidator validator = new SqlSafetyValidator();

    @Test
    void enforceLimitAppendsPlaceholderWhenLimitIsMissing() {
        String sql = "SELECT COUNT(id) FROM orders WHERE store_id IN (:allowedStoreIds)";

        String enforcedSql = validator.enforceLimit(sql, 500);

        assertThat(enforcedSql).endsWith("LIMIT :limit");
    }

    @Test
    void enforceLimitKeepsSafeExplicitLimit() {
        String sql = "SELECT id FROM orders WHERE store_id IN (:allowedStoreIds) LIMIT 50";

        String enforcedSql = validator.enforceLimit(sql, 500);

        assertThat(enforcedSql).isEqualTo(sql);
    }

    @Test
    void enforceLimitReplacesExplicitLimitAboveMax() {
        String sql = "SELECT id FROM orders WHERE store_id IN (:allowedStoreIds) LIMIT 10000";

        String enforcedSql = validator.enforceLimit(sql, 500);

        assertThat(enforcedSql).isEqualTo("SELECT id FROM orders WHERE store_id IN (:allowedStoreIds) LIMIT :limit");
    }

    @Test
    void enforceLimitRejectsUnsupportedLimitSyntax() {
        String sql = "SELECT id FROM orders WHERE store_id IN (:allowedStoreIds) LIMIT ALL";

        assertThatThrownBy(() -> validator.enforceLimit(sql, 500))
            .isInstanceOf(SqlSafetyValidator.SqlValidationException.class)
            .hasMessageContaining("LIMIT must be numeric or :limit");
    }

    @Test
    void validateRejectsCorporateQueryWithoutStoreScope() {
        String sql = "SELECT COUNT(id) FROM orders";

        assertThatThrownBy(() -> validator.validate(sql, RoleType.CORPORATE))
            .isInstanceOf(SqlSafetyValidator.SqlValidationException.class)
            .hasMessageContaining("Corporate queries must include store scope");
    }

    @Test
    void validateAllowsCteSelectForAdmin() {
        String sql = """
            WITH product_data AS (
                SELECT p.id, p.total_sales
                FROM products p
            )
            SELECT pd.id, pd.total_sales
            FROM product_data pd
            LIMIT 20
            """;

        validator.validate(sql, RoleType.ADMIN);
    }

    @Test
    void validateAllowsMultipleCtesForAdmin() {
        String sql = """
            WITH product_data AS (
                SELECT p.id, p.total_sales
                FROM products p
            ),
            review_data AS (
                SELECT r.product_id, COUNT(r.id) AS review_count
                FROM reviews r
                GROUP BY r.product_id
            )
            SELECT pd.id, rd.review_count
            FROM product_data pd
            JOIN review_data rd ON rd.product_id = pd.id
            LIMIT 20
            """;

        validator.validate(sql, RoleType.ADMIN);
    }
}
