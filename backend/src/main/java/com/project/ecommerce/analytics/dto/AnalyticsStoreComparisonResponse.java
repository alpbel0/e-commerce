package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record AnalyticsStoreComparisonResponse(
    UUID storeId,
    String storeName,
    long totalOrders,
    BigDecimal totalRevenue,
    BigDecimal averageOrderValue,
    BigDecimal revenuePerProduct
) {
}
