package com.project.ecommerce.analytics.web;

import com.project.ecommerce.analytics.dto.AdminSummaryResponse;
import com.project.ecommerce.analytics.dto.CorporateSummaryResponse;
import com.project.ecommerce.analytics.dto.RankedProductResponse;
import com.project.ecommerce.analytics.dto.RankedStoreResponse;
import com.project.ecommerce.analytics.dto.StoreRevenueResponse;
import com.project.ecommerce.analytics.service.AnalyticsService;
import com.project.ecommerce.common.api.ApiListResponse;
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
    public AdminSummaryResponse adminSummary() {
        return analyticsService.adminSummary();
    }

    @GetMapping("/admin/top-products")
    public ApiListResponse<RankedProductResponse> adminTopProducts(@RequestParam(required = false) Integer limit) {
        return analyticsService.adminTopProducts(limit);
    }

    @GetMapping("/admin/top-stores")
    public ApiListResponse<RankedStoreResponse> adminTopStores(@RequestParam(required = false) Integer limit) {
        return analyticsService.adminTopStores(limit);
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
