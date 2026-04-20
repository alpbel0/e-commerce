package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record AnalyticsCategoryPerformanceResponse(
    UUID categoryId,
    String categoryName,
    long totalOrders,
    long totalUnitsSold,
    BigDecimal totalRevenue
) {
}
