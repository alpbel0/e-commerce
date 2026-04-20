package com.project.ecommerce.analytics.web;

import com.project.ecommerce.analytics.dto.AdminAnalyticsFilterOptionsResponse;
import com.project.ecommerce.analytics.dto.AdminSummaryResponse;
import com.project.ecommerce.analytics.dto.AnalyticsCategoryPerformanceResponse;
import com.project.ecommerce.analytics.dto.AnalyticsStoreComparisonResponse;
import com.project.ecommerce.analytics.dto.AnalyticsTrendPointResponse;
import com.project.ecommerce.analytics.dto.CorporateSummaryResponse;
import com.project.ecommerce.analytics.dto.RankedProductResponse;
import com.project.ecommerce.analytics.dto.RankedStoreResponse;
import com.project.ecommerce.analytics.dto.StoreRevenueResponse;
import com.project.ecommerce.analytics.service.AnalyticsService;
import com.project.ecommerce.common.api.ApiListResponse;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/admin/summary")
    public AdminSummaryResponse adminSummary(@RequestParam(required = false) String currency) {
        return analyticsService.adminSummary(currency);
    }

    @GetMapping("/admin/filter-options")
    public AdminAnalyticsFilterOptionsResponse adminFilterOptions() {
        return analyticsService.adminFilterOptions();
    }

    @GetMapping("/admin/top-products")
    public ApiListResponse<RankedProductResponse> adminTopProducts(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) String currency,
        @RequestParam(required = false) List<UUID> storeIds,
        @RequestParam(required = false) UUID categoryId,
        @RequestParam(required = false) String productStatus,
        @RequestParam(required = false) String stockStatus,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.adminTopProducts(limit, currency, storeIds, categoryId, productStatus, stockStatus, from, to);
    }

    @GetMapping("/admin/top-stores")
    public ApiListResponse<RankedStoreResponse> adminTopStores(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) String currency
    ) {
        return analyticsService.adminTopStores(limit, currency);
    }

    @GetMapping("/admin/store-comparison")
    public ApiListResponse<AnalyticsStoreComparisonResponse> adminStoreComparison(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) String currency,
        @RequestParam(required = false) List<UUID> storeIds,
        @RequestParam(required = false) UUID categoryId,
        @RequestParam(required = false) String productStatus,
        @RequestParam(required = false) String stockStatus,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.adminStoreComparison(limit, currency, storeIds, categoryId, productStatus, stockStatus, from, to);
    }

    @GetMapping("/admin/trends")
    public ApiListResponse<AnalyticsTrendPointResponse> adminTrends(
        @RequestParam(required = false) String currency,
        @RequestParam(required = false) List<UUID> storeIds,
        @RequestParam(required = false) UUID categoryId,
        @RequestParam(required = false) String productStatus,
        @RequestParam(required = false) String stockStatus,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.adminTrends(currency, storeIds, categoryId, productStatus, stockStatus, from, to);
    }

    @GetMapping("/admin/category-performance")
    public ApiListResponse<AnalyticsCategoryPerformanceResponse> adminCategoryPerformance(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) String currency,
        @RequestParam(required = false) List<UUID> storeIds,
        @RequestParam(required = false) UUID categoryId,
        @RequestParam(required = false) String productStatus,
        @RequestParam(required = false) String stockStatus,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to
    ) {
        return analyticsService.adminCategoryPerformance(
            limit,
            currency,
            storeIds,
            categoryId,
            productStatus,
            stockStatus,
            from,
            to
        );
    }

    @GetMapping("/corporate/summary")
    public CorporateSummaryResponse corporateSummary(@RequestParam(required = false) UUID storeId) {
        return analyticsService.corporateSummary(storeId);
    }

    @GetMapping("/corporate/top-products")
    public ApiListResponse<RankedProductResponse> corporateTopProducts(
        @RequestParam(required = false) UUID storeId,
        @RequestParam(required = false) Integer limit
    ) {
        return analyticsService.corporateTopProducts(storeId, limit);
    }

    @GetMapping("/corporate/revenue-by-store")
    public ApiListResponse<StoreRevenueResponse> corporateRevenueByStore(@RequestParam(required = false) UUID storeId) {
        return analyticsService.corporateRevenueByStore(storeId);
    }
}
