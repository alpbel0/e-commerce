package com.project.ecommerce.analytics.service;

import com.project.ecommerce.analytics.dto.AdminSummaryResponse;
import com.project.ecommerce.analytics.dto.CorporateSummaryResponse;
import com.project.ecommerce.analytics.dto.RankedProductResponse;
import com.project.ecommerce.analytics.dto.RankedStoreResponse;
import com.project.ecommerce.analytics.dto.StoreRevenueResponse;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.common.api.ApiListResponse;
import com.project.ecommerce.store.repository.StoreRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AnalyticsService {

    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 20;

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final StoreRepository storeRepository;

    public AnalyticsService(
        JdbcTemplate jdbcTemplate,
        CurrentUserService currentUserService,
        StoreRepository storeRepository
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.storeRepository = storeRepository;
    }

    @PreAuthorize("hasRole('ADMIN')")
    public AdminSummaryResponse adminSummary() {
        return jdbcTemplate.queryForObject(
            """
            SELECT
                COALESCE((SELECT SUM(grand_total) FROM orders), 0.00) AS total_revenue,
                (SELECT COUNT(*) FROM orders) AS total_orders,
                (SELECT COUNT(DISTINCT user_id) FROM orders) AS total_customers,
                (SELECT COUNT(*) FROM stores) AS total_stores,
                (SELECT COUNT(*) FROM products) AS total_products
            """,
            (resultSet, rowNum) -> new AdminSummaryResponse(
                money(resultSet.getBigDecimal("total_revenue")),
                resultSet.getLong("total_orders"),
                resultSet.getLong("total_customers"),
                resultSet.getLong("total_stores"),
                resultSet.getLong("total_products")
            )
        );
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<RankedProductResponse> adminTopProducts(Integer limit) {
        List<RankedProductResponse> items = jdbcTemplate.query(
            """
            SELECT
                oi.product_id,
                p.title AS product_title,
                o.store_id,
                s.name AS store_name,
                SUM(oi.quantity) AS total_quantity_sold,
                COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            JOIN stores s ON s.id = o.store_id
            GROUP BY oi.product_id, p.title, o.store_id, s.name
            ORDER BY total_quantity_sold DESC, total_revenue DESC
            LIMIT ?
            """,
            (resultSet, rowNum) -> new RankedProductResponse(
                resultSet.getObject("product_id", UUID.class),
                resultSet.getString("product_title"),
                resultSet.getObject("store_id", UUID.class),
                resultSet.getString("store_name"),
                resultSet.getLong("total_quantity_sold"),
                money(resultSet.getBigDecimal("total_revenue"))
            ),
            resolveLimit(limit)
        );
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<RankedStoreResponse> adminTopStores(Integer limit) {
        List<RankedStoreResponse> items = jdbcTemplate.query(
            """
            SELECT
                o.store_id,
                s.name AS store_name,
                COUNT(*) AS total_orders,
                COALESCE(SUM(o.grand_total), 0.00) AS total_revenue
            FROM orders o
            JOIN stores s ON s.id = o.store_id
            GROUP BY o.store_id, s.name
            ORDER BY total_revenue DESC, total_orders DESC
            LIMIT ?
            """,
            (resultSet, rowNum) -> new RankedStoreResponse(
                resultSet.getObject("store_id", UUID.class),
                resultSet.getString("store_name"),
                resultSet.getLong("total_orders"),
                money(resultSet.getBigDecimal("total_revenue"))
            ),
            resolveLimit(limit)
        );
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('CORPORATE')")
    public CorporateSummaryResponse corporateSummary(UUID storeId) {
        UUID ownerId = requireCorporateUserId();
        UUID validatedStoreId = validateCorporateStoreScope(ownerId, storeId);

        if (validatedStoreId == null) {
            return jdbcTemplate.queryForObject(
                """
                SELECT
                    COALESCE((SELECT SUM(o.grand_total) FROM orders o JOIN stores s ON s.id = o.store_id WHERE s.owner_id = ?), 0.00) AS total_revenue,
                    (SELECT COUNT(*) FROM orders o JOIN stores s ON s.id = o.store_id WHERE s.owner_id = ?) AS total_orders,
                    (SELECT COUNT(*) FROM products p JOIN stores s ON s.id = p.store_id WHERE s.owner_id = ?) AS total_products,
                    COALESCE((SELECT AVG(o.grand_total) FROM orders o JOIN stores s ON s.id = o.store_id WHERE s.owner_id = ?), 0.00) AS average_order_value,
                    (SELECT COUNT(*) FROM reviews r JOIN products p ON p.id = r.product_id JOIN stores s ON s.id = p.store_id WHERE s.owner_id = ?) AS total_reviews
                """,
                (resultSet, rowNum) -> new CorporateSummaryResponse(
                    money(resultSet.getBigDecimal("total_revenue")),
                    resultSet.getLong("total_orders"),
                    resultSet.getLong("total_products"),
                    money(resultSet.getBigDecimal("average_order_value")),
                    resultSet.getLong("total_reviews")
                ),
                ownerId, ownerId, ownerId, ownerId, ownerId
            );
        }

        return jdbcTemplate.queryForObject(
            """
            SELECT
                COALESCE((SELECT SUM(grand_total) FROM orders WHERE store_id = ?), 0.00) AS total_revenue,
                (SELECT COUNT(*) FROM orders WHERE store_id = ?) AS total_orders,
                (SELECT COUNT(*) FROM products WHERE store_id = ?) AS total_products,
                COALESCE((SELECT AVG(grand_total) FROM orders WHERE store_id = ?), 0.00) AS average_order_value,
                (SELECT COUNT(*) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.store_id = ?) AS total_reviews
            """,
            (resultSet, rowNum) -> new CorporateSummaryResponse(
                money(resultSet.getBigDecimal("total_revenue")),
                resultSet.getLong("total_orders"),
                resultSet.getLong("total_products"),
                money(resultSet.getBigDecimal("average_order_value")),
                resultSet.getLong("total_reviews")
            ),
            validatedStoreId, validatedStoreId, validatedStoreId, validatedStoreId, validatedStoreId
        );
    }

    @PreAuthorize("hasRole('CORPORATE')")
    public ApiListResponse<RankedProductResponse> corporateTopProducts(UUID storeId, Integer limit) {
        UUID ownerId = requireCorporateUserId();
        UUID validatedStoreId = validateCorporateStoreScope(ownerId, storeId);
        List<RankedProductResponse> items;

        if (validatedStoreId == null) {
            items = jdbcTemplate.query(
                """
                SELECT
                    oi.product_id,
                    p.title AS product_title,
                    o.store_id,
                    s.name AS store_name,
                    SUM(oi.quantity) AS total_quantity_sold,
                    COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN stores s ON s.id = o.store_id
                JOIN products p ON p.id = oi.product_id
                WHERE s.owner_id = ?
                GROUP BY oi.product_id, p.title, o.store_id, s.name
                ORDER BY total_quantity_sold DESC, total_revenue DESC
                LIMIT ?
                """,
                (resultSet, rowNum) -> new RankedProductResponse(
                    resultSet.getObject("product_id", UUID.class),
                    resultSet.getString("product_title"),
                    resultSet.getObject("store_id", UUID.class),
                    resultSet.getString("store_name"),
                    resultSet.getLong("total_quantity_sold"),
                    money(resultSet.getBigDecimal("total_revenue"))
                ),
                ownerId, resolveLimit(limit)
            );
        } else {
            items = jdbcTemplate.query(
                """
                SELECT
                    oi.product_id,
                    p.title AS product_title,
                    o.store_id,
                    s.name AS store_name,
                    SUM(oi.quantity) AS total_quantity_sold,
                    COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN stores s ON s.id = o.store_id
                JOIN products p ON p.id = oi.product_id
                WHERE o.store_id = ?
                GROUP BY oi.product_id, p.title, o.store_id, s.name
                ORDER BY total_quantity_sold DESC, total_revenue DESC
                LIMIT ?
                """,
                (resultSet, rowNum) -> new RankedProductResponse(
                    resultSet.getObject("product_id", UUID.class),
                    resultSet.getString("product_title"),
                    resultSet.getObject("store_id", UUID.class),
                    resultSet.getString("store_name"),
                    resultSet.getLong("total_quantity_sold"),
                    money(resultSet.getBigDecimal("total_revenue"))
                ),
                validatedStoreId, resolveLimit(limit)
            );
        }

        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('CORPORATE')")
    public ApiListResponse<StoreRevenueResponse> corporateRevenueByStore(UUID storeId) {
        UUID ownerId = requireCorporateUserId();
        UUID validatedStoreId = validateCorporateStoreScope(ownerId, storeId);
        List<StoreRevenueResponse> items;

        if (validatedStoreId == null) {
            items = jdbcTemplate.query(
                """
                SELECT
                    s.id AS store_id,
                    s.name AS store_name,
                    COUNT(o.id) AS total_orders,
                    COALESCE(SUM(o.grand_total), 0.00) AS total_revenue
                FROM stores s
                LEFT JOIN orders o ON o.store_id = s.id
                WHERE s.owner_id = ?
                GROUP BY s.id, s.name
                ORDER BY total_revenue DESC, total_orders DESC, s.name ASC
                """,
                (resultSet, rowNum) -> new StoreRevenueResponse(
                    resultSet.getObject("store_id", UUID.class),
                    resultSet.getString("store_name"),
                    resultSet.getLong("total_orders"),
                    money(resultSet.getBigDecimal("total_revenue"))
                ),
                ownerId
            );
        } else {
            items = jdbcTemplate.query(
                """
                SELECT
                    s.id AS store_id,
                    s.name AS store_name,
                    COUNT(o.id) AS total_orders,
                    COALESCE(SUM(o.grand_total), 0.00) AS total_revenue
                FROM stores s
                LEFT JOIN orders o ON o.store_id = s.id
                WHERE s.id = ?
                GROUP BY s.id, s.name
                ORDER BY s.name ASC
                """,
                (resultSet, rowNum) -> new StoreRevenueResponse(
                    resultSet.getObject("store_id", UUID.class),
                    resultSet.getString("store_name"),
                    resultSet.getLong("total_orders"),
                    money(resultSet.getBigDecimal("total_revenue"))
                ),
                validatedStoreId
            );
        }

        return new ApiListResponse<>(items, items.size());
    }

    private UUID requireCorporateUserId() {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.CORPORATE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return authenticatedUser.getUserId();
    }

    private UUID validateCorporateStoreScope(UUID ownerId, UUID storeId) {
        if (storeId == null) {
            return null;
        }
        boolean exists = storeRepository.findByIdAndOwnerId(storeId, ownerId).isPresent();
        if (!exists) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requested store is outside your scope");
        }
        return storeId;
    }

    private int resolveLimit(Integer requestedLimit) {
        if (requestedLimit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    }

    private BigDecimal money(BigDecimal value) {
        if (value == null) {
            return new BigDecimal("0.00");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
