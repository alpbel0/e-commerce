package com.project.ecommerce.analytics.service;

import com.project.ecommerce.analytics.dto.AdminAnalyticsFilterOptionsResponse;
import com.project.ecommerce.analytics.dto.AdminSummaryResponse;
import com.project.ecommerce.analytics.dto.AnalyticsCategoryPerformanceResponse;
import com.project.ecommerce.analytics.dto.AnalyticsFilterOptionResponse;
import com.project.ecommerce.analytics.dto.AnalyticsStoreComparisonResponse;
import com.project.ecommerce.analytics.dto.AnalyticsTrendPointResponse;
import com.project.ecommerce.analytics.dto.CorporateSummaryResponse;
import com.project.ecommerce.analytics.dto.RankedProductResponse;
import com.project.ecommerce.analytics.dto.RankedStoreResponse;
import com.project.ecommerce.analytics.dto.StoreRevenueResponse;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.common.api.ApiListResponse;
import com.project.ecommerce.currencyrate.dto.CurrencyRateResponse;
import com.project.ecommerce.currencyrate.service.CurrencyRateService;
import com.project.ecommerce.store.repository.StoreRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final int MAX_ADMIN_STORE_LIMIT = 5_000;
    private static final String DEFAULT_ADMIN_CURRENCY = "TRY";
    private static final int DEFAULT_COMPARISON_LIMIT = 3;
    private static final int MAX_FILTER_STORE_OPTIONS = 250;
    private static final int LOW_STOCK_THRESHOLD = 10;
    private static final DateTimeFormatter TREND_LABEL_FORMAT = DateTimeFormatter.ofPattern("dd MMM", Locale.forLanguageTag("tr-TR"));

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final StoreRepository storeRepository;
    private final CurrencyRateService currencyRateService;

    public AnalyticsService(
        JdbcTemplate jdbcTemplate,
        CurrentUserService currentUserService,
        StoreRepository storeRepository,
        CurrencyRateService currencyRateService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.storeRepository = storeRepository;
        this.currencyRateService = currencyRateService;
    }

    @PreAuthorize("hasRole('ADMIN')")
    public AdminSummaryResponse adminSummary(String currency) {
        String targetCurrency = normalizeAdminCurrency(currency);
        CurrencyConverter converter = buildCurrencyConverter(targetCurrency);
        BigDecimal totalRevenue = jdbcTemplate.query(
            """
            SELECT
                currency,
                COALESCE(SUM(grand_total), 0.00) AS total_revenue
            FROM orders
            GROUP BY currency
            """,
            (resultSet, rowNum) -> converter.convert(
                resultSet.getBigDecimal("total_revenue"),
                resultSet.getString("currency")
            )
        ).stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        return jdbcTemplate.queryForObject(
            """
            SELECT
                (SELECT COUNT(*) FROM orders) AS total_orders,
                (SELECT COUNT(DISTINCT user_id) FROM orders) AS total_customers,
                (SELECT COUNT(*) FROM stores) AS total_stores,
                (SELECT COUNT(*) FROM products) AS total_products
            """,
            (resultSet, rowNum) -> new AdminSummaryResponse(
                money(totalRevenue),
                resultSet.getLong("total_orders"),
                resultSet.getLong("total_customers"),
                resultSet.getLong("total_stores"),
                resultSet.getLong("total_products")
            )
        );
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<RankedProductResponse> adminTopProducts(Integer limit, String currency) {
        String targetCurrency = normalizeAdminCurrency(currency);
        int resolvedLimit = resolveLimit(limit);
        List<RankedProductResponse> items = aggregateAdminTopProducts(buildCurrencyConverter(targetCurrency), resolvedLimit).stream()
            .sorted(Comparator
                .comparing(RankedProductResponse::totalQuantitySold, Comparator.reverseOrder())
                .thenComparing(RankedProductResponse::totalRevenue, Comparator.reverseOrder()))
            .toList();
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<RankedProductResponse> adminTopProducts(
        Integer limit,
        String currency,
        List<UUID> storeIds,
        UUID categoryId,
        String productStatus,
        String stockStatus,
        LocalDate from,
        LocalDate to
    ) {
        String targetCurrency = normalizeAdminCurrency(currency);
        int resolvedLimit = resolveLimit(limit);
        AdminAnalyticsFilter filter = buildAdminAnalyticsFilter(storeIds, categoryId, productStatus, stockStatus, from, to);
        List<RankedProductResponse> items = aggregateAdminTopProducts(buildCurrencyConverter(targetCurrency), resolvedLimit, filter).stream()
            .sorted(Comparator
                .comparing(RankedProductResponse::totalQuantitySold, Comparator.reverseOrder())
                .thenComparing(RankedProductResponse::totalRevenue, Comparator.reverseOrder()))
            .toList();
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<RankedStoreResponse> adminTopStores(Integer limit, String currency) {
        String targetCurrency = normalizeAdminCurrency(currency);
        int resolvedLimit = resolveAdminStoreLimit(limit);
        List<RankedStoreResponse> items = aggregateAdminTopStores(buildCurrencyConverter(targetCurrency), resolvedLimit).stream()
            .sorted(Comparator
                .comparing(RankedStoreResponse::totalRevenue, Comparator.reverseOrder())
                .thenComparing(RankedStoreResponse::totalOrders, Comparator.reverseOrder())
                .thenComparing(RankedStoreResponse::storeName))
            .toList();
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public AdminAnalyticsFilterOptionsResponse adminFilterOptions() {
        List<AnalyticsFilterOptionResponse> stores = jdbcTemplate.query(
            """
            SELECT s.id, s.name
            FROM stores s
            WHERE EXISTS (
                SELECT 1
                FROM products p
                WHERE p.store_id = s.id
            )
            ORDER BY COALESCE(s.product_count, 0) DESC, s.name ASC
            LIMIT ?
            """,
            (resultSet, rowNum) -> new AnalyticsFilterOptionResponse(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("name")
            ),
            MAX_FILTER_STORE_OPTIONS
        );

        List<AnalyticsFilterOptionResponse> categories = jdbcTemplate.query(
            """
            SELECT c.id, c.name
            FROM categories c
            WHERE c.is_active = TRUE
              AND EXISTS (
                  SELECT 1
                  FROM products p
                  WHERE p.category_id = c.id
              )
            ORDER BY c.display_order ASC, c.name ASC
            """,
            (resultSet, rowNum) -> new AnalyticsFilterOptionResponse(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("name")
            )
        );

        return new AdminAnalyticsFilterOptionsResponse(stores, categories);
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<AnalyticsStoreComparisonResponse> adminStoreComparison(
        Integer limit,
        String currency,
        List<UUID> storeIds,
        UUID categoryId,
        String productStatus,
        String stockStatus,
        LocalDate from,
        LocalDate to
    ) {
        String targetCurrency = normalizeAdminCurrency(currency);
        AdminAnalyticsFilter baseFilter = buildAdminAnalyticsFilter(storeIds, categoryId, productStatus, stockStatus, from, to);
        int resolvedLimit = Math.min(Math.max(limit == null ? DEFAULT_COMPARISON_LIMIT : limit, 1), 3);
        List<UUID> resolvedStoreIds = resolveComparisonStoreIds(baseFilter, resolvedLimit);

        if (resolvedStoreIds.isEmpty()) {
            return new ApiListResponse<>(List.of(), 0);
        }

        AdminAnalyticsFilter filter = new AdminAnalyticsFilter(
            resolvedStoreIds,
            baseFilter.categoryId(),
            baseFilter.productStatus(),
            baseFilter.stockStatus(),
            baseFilter.fromDateTime(),
            baseFilter.toDateTimeExclusive()
        );
        CurrencyConverter converter = buildCurrencyConverter(targetCurrency);

        StringBuilder sql = new StringBuilder(
            """
            SELECT
                p.store_id AS store_id,
                s.name AS store_name,
                o.currency AS order_currency,
                COUNT(DISTINCT o.id) AS total_orders,
                COUNT(DISTINCT oi.product_id) AS product_count,
                COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            JOIN stores s ON s.id = p.store_id
            WHERE 1 = 1
            """
        );
        List<Object> params = new ArrayList<>();
        appendAnalyticsFilters(sql, params, filter);
        sql.append(" GROUP BY p.store_id, s.name, o.currency");

        List<StoreComparisonRow> rows = jdbcTemplate.query(
            sql.toString(),
            (resultSet, rowNum) -> new StoreComparisonRow(
                resultSet.getObject("store_id", UUID.class),
                resultSet.getString("store_name"),
                resultSet.getString("order_currency"),
                resultSet.getLong("total_orders"),
                resultSet.getLong("product_count"),
                resultSet.getBigDecimal("total_revenue")
            ),
            params.toArray()
        );

        Map<UUID, MutableStoreComparison> aggregated = new LinkedHashMap<>();
        for (StoreComparisonRow row : rows) {
            MutableStoreComparison item = aggregated.computeIfAbsent(
                row.storeId(),
                ignored -> new MutableStoreComparison(row.storeId(), row.storeName())
            );
            item.totalOrders += row.totalOrders();
            item.productCount += row.productCount();
            item.totalRevenue = item.totalRevenue.add(converter.convert(row.totalRevenue(), row.orderCurrency()));
        }

        List<AnalyticsStoreComparisonResponse> items = aggregated.values().stream()
            .map(MutableStoreComparison::toResponse)
            .sorted(Comparator.comparing(AnalyticsStoreComparisonResponse::totalRevenue, Comparator.reverseOrder()))
            .toList();
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<AnalyticsTrendPointResponse> adminTrends(
        String currency,
        List<UUID> storeIds,
        UUID categoryId,
        String productStatus,
        String stockStatus,
        LocalDate from,
        LocalDate to
    ) {
        String targetCurrency = normalizeAdminCurrency(currency);
        AdminAnalyticsFilter filter = buildAdminAnalyticsFilter(storeIds, categoryId, productStatus, stockStatus, from, to);
        CurrencyConverter converter = buildCurrencyConverter(targetCurrency);

        StringBuilder sql = new StringBuilder(
            """
            SELECT
                DATE(o.order_date) AS trend_date,
                o.currency AS order_currency,
                COUNT(DISTINCT o.id) AS total_orders,
                COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
                COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            WHERE 1 = 1
            """
        );
        List<Object> params = new ArrayList<>();
        appendAnalyticsFilters(sql, params, filter);
        sql.append(" GROUP BY DATE(o.order_date), o.currency ORDER BY trend_date ASC");

        List<TrendRow> rows = jdbcTemplate.query(
            sql.toString(),
            (resultSet, rowNum) -> new TrendRow(
                resultSet.getObject("trend_date", LocalDate.class),
                resultSet.getString("order_currency"),
                resultSet.getLong("total_orders"),
                resultSet.getLong("total_units_sold"),
                resultSet.getBigDecimal("total_revenue")
            ),
            params.toArray()
        );

        Map<LocalDate, MutableTrendPoint> aggregated = new LinkedHashMap<>();
        for (TrendRow row : rows) {
            MutableTrendPoint item = aggregated.computeIfAbsent(
                row.trendDate(),
                ignored -> new MutableTrendPoint(row.trendDate())
            );
            item.totalOrders += row.totalOrders();
            item.totalUnitsSold += row.totalUnitsSold();
            item.totalRevenue = item.totalRevenue.add(converter.convert(row.totalRevenue(), row.orderCurrency()));
        }

        List<AnalyticsTrendPointResponse> items = aggregated.values().stream()
            .map(MutableTrendPoint::toResponse)
            .toList();
        return new ApiListResponse<>(items, items.size());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiListResponse<AnalyticsCategoryPerformanceResponse> adminCategoryPerformance(
        Integer limit,
        String currency,
        List<UUID> storeIds,
        UUID categoryId,
        String productStatus,
        String stockStatus,
        LocalDate from,
        LocalDate to
    ) {
        String targetCurrency = normalizeAdminCurrency(currency);
        AdminAnalyticsFilter filter = buildAdminAnalyticsFilter(storeIds, categoryId, productStatus, stockStatus, from, to);
        CurrencyConverter converter = buildCurrencyConverter(targetCurrency);

        StringBuilder sql = new StringBuilder(
            """
            SELECT
                c.id AS category_id,
                c.name AS category_name,
                o.currency AS order_currency,
                COUNT(DISTINCT o.id) AS total_orders,
                COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
                COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE 1 = 1
            """
        );
        List<Object> params = new ArrayList<>();
        appendAnalyticsFilters(sql, params, filter);
        sql.append(" GROUP BY c.id, c.name, o.currency");

        List<CategoryPerformanceRow> rows = jdbcTemplate.query(
            sql.toString(),
            (resultSet, rowNum) -> new CategoryPerformanceRow(
                resultSet.getObject("category_id", UUID.class),
                resultSet.getString("category_name"),
                resultSet.getString("order_currency"),
                resultSet.getLong("total_orders"),
                resultSet.getLong("total_units_sold"),
                resultSet.getBigDecimal("total_revenue")
            ),
            params.toArray()
        );

        Map<UUID, MutableCategoryPerformance> aggregated = new LinkedHashMap<>();
        for (CategoryPerformanceRow row : rows) {
            MutableCategoryPerformance item = aggregated.computeIfAbsent(
                row.categoryId(),
                ignored -> new MutableCategoryPerformance(row.categoryId(), row.categoryName())
            );
            item.totalOrders += row.totalOrders();
            item.totalUnitsSold += row.totalUnitsSold();
            item.totalRevenue = item.totalRevenue.add(converter.convert(row.totalRevenue(), row.orderCurrency()));
        }

        int resolvedLimit = resolveLimit(limit);
        List<AnalyticsCategoryPerformanceResponse> items = aggregated.values().stream()
            .map(MutableCategoryPerformance::toResponse)
            .sorted(Comparator.comparing(AnalyticsCategoryPerformanceResponse::totalRevenue, Comparator.reverseOrder()))
            .limit(resolvedLimit)
            .toList();
        return new ApiListResponse<>(items, items.size());
    }

    private List<RankedProductResponse> aggregateAdminTopProducts(CurrencyConverter converter, int limit) {
        return aggregateAdminTopProducts(
            converter,
            limit,
            new AdminAnalyticsFilter(List.of(), null, null, null, null, null)
        );
    }

    private List<RankedProductResponse> aggregateAdminTopProducts(
        CurrencyConverter converter,
        int limit,
        AdminAnalyticsFilter filter
    ) {
        StringBuilder cte = new StringBuilder(
            """
            WITH top_products AS (
                SELECT
                    oi.product_id
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN products p ON p.id = oi.product_id
                WHERE 1 = 1
            """
        );
        List<Object> params = new ArrayList<>();
        appendAnalyticsFilters(cte, params, filter);
        cte.append(
            """
                GROUP BY oi.product_id
                ORDER BY SUM(oi.quantity) DESC, COALESCE(SUM(oi.subtotal), 0.00) DESC
                LIMIT ?
            )
            SELECT
                oi.product_id,
                p.title AS product_title,
                p.store_id,
                s.name AS store_name,
                o.currency AS order_currency,
                SUM(oi.quantity) AS total_quantity_sold,
                COALESCE(SUM(oi.subtotal), 0.00) AS total_revenue
            FROM order_items oi
            JOIN top_products tp ON tp.product_id = oi.product_id
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            JOIN stores s ON s.id = p.store_id
            WHERE 1 = 1
            """
        );
        params.add(limit);
        appendAnalyticsFilters(cte, params, filter);
        cte.append(" GROUP BY oi.product_id, p.title, p.store_id, s.name, o.currency");

        List<AdminProductRevenueRow> rows = jdbcTemplate.query(
            cte.toString(),
            (resultSet, rowNum) -> new AdminProductRevenueRow(
                resultSet.getObject("product_id", UUID.class),
                resultSet.getString("product_title"),
                resultSet.getObject("store_id", UUID.class),
                resultSet.getString("store_name"),
                resultSet.getString("order_currency"),
                resultSet.getLong("total_quantity_sold"),
                resultSet.getBigDecimal("total_revenue")
            ),
            params.toArray()
        );

        Map<UUID, MutableRankedProduct> aggregated = new LinkedHashMap<>();
        for (AdminProductRevenueRow row : rows) {
            MutableRankedProduct item = aggregated.computeIfAbsent(
                row.productId(),
                ignored -> new MutableRankedProduct(row.productId(), row.productTitle(), row.storeId(), row.storeName())
            );
            item.totalQuantitySold += row.totalQuantitySold();
            item.totalRevenue = item.totalRevenue.add(converter.convert(row.totalRevenue(), row.orderCurrency()));
        }
        return aggregated.values().stream()
            .map(MutableRankedProduct::toResponse)
            .toList();
    }

    private List<RankedStoreResponse> aggregateAdminTopStores(CurrencyConverter converter, int limit) {
        List<AdminStoreRevenueRow> rows = jdbcTemplate.query(
            """
            WITH top_stores AS (
                SELECT
                    o.store_id
                FROM orders o
                GROUP BY o.store_id
                ORDER BY COUNT(o.id) DESC, COALESCE(SUM(o.grand_total), 0.00) DESC
                LIMIT ?
            )
            SELECT
                s.id AS store_id,
                s.name AS store_name,
                o.currency AS order_currency,
                COUNT(o.id) AS total_orders,
                COALESCE(SUM(o.grand_total), 0.00) AS total_revenue
            FROM top_stores ts
            JOIN stores s ON s.id = ts.store_id
            JOIN orders o ON o.store_id = s.id
            GROUP BY s.id, s.name, o.currency
            """,
            (resultSet, rowNum) -> new AdminStoreRevenueRow(
                resultSet.getObject("store_id", UUID.class),
                resultSet.getString("store_name"),
                resultSet.getString("order_currency"),
                resultSet.getLong("total_orders"),
                resultSet.getBigDecimal("total_revenue")
            ),
            limit
        );

        Map<UUID, MutableRankedStore> aggregated = new LinkedHashMap<>();
        for (AdminStoreRevenueRow row : rows) {
            MutableRankedStore item = aggregated.computeIfAbsent(
                row.storeId(),
                ignored -> new MutableRankedStore(row.storeId(), row.storeName())
            );
            item.totalOrders += row.totalOrders();
            item.totalRevenue = item.totalRevenue.add(converter.convert(row.totalRevenue(), row.orderCurrency()));
        }
        return aggregated.values().stream()
            .map(MutableRankedStore::toResponse)
            .toList();
    }

    private AdminAnalyticsFilter buildAdminAnalyticsFilter(
        List<UUID> storeIds,
        UUID categoryId,
        String productStatus,
        String stockStatus,
        LocalDate from,
        LocalDate to
    ) {
        LocalDate fromDate = from != null ? from : LocalDate.now().minusDays(29);
        LocalDate toDate = to != null ? to : LocalDate.now();
        if (toDate.isBefore(fromDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date range");
        }

        List<UUID> normalizedStoreIds = storeIds == null ? List.of() : storeIds.stream().distinct().toList();
        return new AdminAnalyticsFilter(
            normalizedStoreIds,
            categoryId,
            normalizeProductStatus(productStatus),
            normalizeStockStatus(stockStatus),
            fromDate.atStartOfDay(),
            toDate.plusDays(1).atStartOfDay()
        );
    }

    private void appendAnalyticsFilters(StringBuilder sql, List<Object> params, AdminAnalyticsFilter filter) {
        if (!filter.storeIds().isEmpty()) {
            sql.append(" AND p.store_id IN (");
            for (int index = 0; index < filter.storeIds().size(); index++) {
                if (index > 0) {
                    sql.append(", ");
                }
                sql.append("?");
                params.add(filter.storeIds().get(index));
            }
            sql.append(")");
        }

        if (filter.categoryId() != null) {
            sql.append(" AND p.category_id = ?");
            params.add(filter.categoryId());
        }

        if (filter.productStatus() != null) {
            sql.append(" AND p.is_active = ?");
            params.add("ACTIVE".equals(filter.productStatus()));
        }

        if (filter.stockStatus() != null) {
            switch (filter.stockStatus()) {
                case "IN_STOCK" -> sql.append(" AND p.stock_quantity > 0");
                case "LOW_STOCK" -> {
                    sql.append(" AND p.stock_quantity BETWEEN 1 AND ?");
                    params.add(LOW_STOCK_THRESHOLD);
                }
                case "OUT_OF_STOCK" -> sql.append(" AND p.stock_quantity = 0");
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported stock status");
            }
        }

        if (filter.fromDateTime() != null) {
            sql.append(" AND o.order_date >= ?");
            params.add(filter.fromDateTime());
        }

        if (filter.toDateTimeExclusive() != null) {
            sql.append(" AND o.order_date < ?");
            params.add(filter.toDateTimeExclusive());
        }
    }

    private List<UUID> resolveComparisonStoreIds(AdminAnalyticsFilter filter, int limit) {
        if (!filter.storeIds().isEmpty()) {
            return filter.storeIds().stream().limit(limit).toList();
        }

        StringBuilder sql = new StringBuilder(
            """
            SELECT
                p.store_id
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            WHERE 1 = 1
            """
        );
        List<Object> params = new ArrayList<>();
        appendAnalyticsFilters(sql, params, filter);
        sql.append(
            """
             GROUP BY p.store_id
             ORDER BY COALESCE(SUM(oi.subtotal), 0.00) DESC, COUNT(DISTINCT o.id) DESC
             LIMIT ?
            """
        );
        params.add(limit);

        return jdbcTemplate.query(
            sql.toString(),
            (resultSet, rowNum) -> resultSet.getObject("store_id", UUID.class),
            params.toArray()
        );
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

    private int resolveAdminStoreLimit(Integer requestedLimit) {
        if (requestedLimit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.min(Math.max(requestedLimit, 1), MAX_ADMIN_STORE_LIMIT);
    }

    private BigDecimal money(BigDecimal value) {
        if (value == null) {
            return new BigDecimal("0.00");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeAdminCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return DEFAULT_ADMIN_CURRENCY;
        }
        String normalized = currency.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "TRY", "USD", "EUR" -> normalized;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported dashboard currency");
        };
    }

    private CurrencyConverter buildCurrencyConverter(String targetCurrency) {
        Map<String, BigDecimal> usdRates = new HashMap<>();
        usdRates.put("USD", BigDecimal.ONE.setScale(6, RoundingMode.HALF_UP));
        for (CurrencyRateResponse rate : currencyRateService.listUsdRates()) {
            usdRates.put(rate.targetCurrency().trim().toUpperCase(Locale.ROOT), rate.rate().setScale(6, RoundingMode.HALF_UP));
        }
        return new CurrencyConverter(targetCurrency, usdRates);
    }

    private String normalizeProductStatus(String productStatus) {
        if (productStatus == null || productStatus.isBlank()) {
            return null;
        }
        String normalized = productStatus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACTIVE", "INACTIVE" -> normalized;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported product status");
        };
    }

    private String normalizeStockStatus(String stockStatus) {
        if (stockStatus == null || stockStatus.isBlank()) {
            return null;
        }
        String normalized = stockStatus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK" -> normalized;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported stock status");
        };
    }

    private record AdminProductRevenueRow(
        UUID productId,
        String productTitle,
        UUID storeId,
        String storeName,
        String orderCurrency,
        long totalQuantitySold,
        BigDecimal totalRevenue
    ) {
    }

    private record AdminStoreRevenueRow(
        UUID storeId,
        String storeName,
        String orderCurrency,
        long totalOrders,
        BigDecimal totalRevenue
    ) {
    }

    private record AdminAnalyticsFilter(
        List<UUID> storeIds,
        UUID categoryId,
        String productStatus,
        String stockStatus,
        LocalDateTime fromDateTime,
        LocalDateTime toDateTimeExclusive
    ) {
    }

    private record StoreComparisonRow(
        UUID storeId,
        String storeName,
        String orderCurrency,
        long totalOrders,
        long productCount,
        BigDecimal totalRevenue
    ) {
    }

    private record TrendRow(
        LocalDate trendDate,
        String orderCurrency,
        long totalOrders,
        long totalUnitsSold,
        BigDecimal totalRevenue
    ) {
    }

    private record CategoryPerformanceRow(
        UUID categoryId,
        String categoryName,
        String orderCurrency,
        long totalOrders,
        long totalUnitsSold,
        BigDecimal totalRevenue
    ) {
    }

    private static final class MutableRankedProduct {
        private final UUID productId;
        private final String productTitle;
        private final UUID storeId;
        private final String storeName;
        private long totalQuantitySold = 0;
        private BigDecimal totalRevenue = BigDecimal.ZERO;

        private MutableRankedProduct(UUID productId, String productTitle, UUID storeId, String storeName) {
            this.productId = productId;
            this.productTitle = productTitle;
            this.storeId = storeId;
            this.storeName = storeName;
        }

        private RankedProductResponse toResponse() {
            return new RankedProductResponse(
                productId,
                productTitle,
                storeId,
                storeName,
                totalQuantitySold,
                totalRevenue.setScale(2, RoundingMode.HALF_UP)
            );
        }
    }

    private static final class MutableRankedStore {
        private final UUID storeId;
        private final String storeName;
        private long totalOrders = 0;
        private BigDecimal totalRevenue = BigDecimal.ZERO;

        private MutableRankedStore(UUID storeId, String storeName) {
            this.storeId = storeId;
            this.storeName = storeName;
        }

        private RankedStoreResponse toResponse() {
            return new RankedStoreResponse(
                storeId,
                storeName,
                totalOrders,
                totalRevenue.setScale(2, RoundingMode.HALF_UP)
            );
        }
    }

    private static final class MutableStoreComparison {
        private final UUID storeId;
        private final String storeName;
        private long totalOrders = 0;
        private long productCount = 0;
        private BigDecimal totalRevenue = BigDecimal.ZERO;

        private MutableStoreComparison(UUID storeId, String storeName) {
            this.storeId = storeId;
            this.storeName = storeName;
        }

        private AnalyticsStoreComparisonResponse toResponse() {
            BigDecimal safeOrders = BigDecimal.valueOf(Math.max(totalOrders, 1));
            BigDecimal safeProducts = BigDecimal.valueOf(Math.max(productCount, 1));
            return new AnalyticsStoreComparisonResponse(
                storeId,
                storeName,
                totalOrders,
                totalRevenue.setScale(2, RoundingMode.HALF_UP),
                totalRevenue.divide(safeOrders, 2, RoundingMode.HALF_UP),
                totalRevenue.divide(safeProducts, 2, RoundingMode.HALF_UP)
            );
        }
    }

    private static final class MutableTrendPoint {
        private final LocalDate trendDate;
        private long totalOrders = 0;
        private long totalUnitsSold = 0;
        private BigDecimal totalRevenue = BigDecimal.ZERO;

        private MutableTrendPoint(LocalDate trendDate) {
            this.trendDate = trendDate;
        }

        private AnalyticsTrendPointResponse toResponse() {
            return new AnalyticsTrendPointResponse(
                trendDate.format(TREND_LABEL_FORMAT),
                totalOrders,
                totalUnitsSold,
                totalRevenue.setScale(2, RoundingMode.HALF_UP)
            );
        }
    }

    private static final class MutableCategoryPerformance {
        private final UUID categoryId;
        private final String categoryName;
        private long totalOrders = 0;
        private long totalUnitsSold = 0;
        private BigDecimal totalRevenue = BigDecimal.ZERO;

        private MutableCategoryPerformance(UUID categoryId, String categoryName) {
            this.categoryId = categoryId;
            this.categoryName = categoryName;
        }

        private AnalyticsCategoryPerformanceResponse toResponse() {
            return new AnalyticsCategoryPerformanceResponse(
                categoryId,
                categoryName,
                totalOrders,
                totalUnitsSold,
                totalRevenue.setScale(2, RoundingMode.HALF_UP)
            );
        }
    }

    private static final class CurrencyConverter {
        private final String targetCurrency;
        private final Map<String, BigDecimal> usdRates;

        private CurrencyConverter(String targetCurrency, Map<String, BigDecimal> usdRates) {
            this.targetCurrency = targetCurrency;
            this.usdRates = usdRates;
        }

        private BigDecimal convert(BigDecimal amount, String fromCurrency) {
            if (amount == null || amount.compareTo(BigDecimal.ZERO) == 0) {
                return BigDecimal.ZERO;
            }

            String normalizedFrom = (fromCurrency == null || fromCurrency.isBlank())
                ? DEFAULT_ADMIN_CURRENCY
                : fromCurrency.trim().toUpperCase(Locale.ROOT);

            if (normalizedFrom.equals(targetCurrency)) {
                return amount;
            }

            BigDecimal usdAmount = amount.divide(resolveUsdRate(normalizedFrom), 6, RoundingMode.HALF_UP);
            if ("USD".equals(targetCurrency)) {
                return usdAmount;
            }
            return usdAmount.multiply(resolveUsdRate(targetCurrency)).setScale(6, RoundingMode.HALF_UP);
        }

        private BigDecimal resolveUsdRate(String currency) {
            BigDecimal rate = usdRates.get(currency);
            if (rate == null) {
                throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Currency rate not found for USD -> " + currency
                );
            }
            return rate;
        }
    }
}
