package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;

public record AnalyticsTrendPointResponse(
    String label,
    long totalOrders,
    long totalUnitsSold,
    BigDecimal totalRevenue
) {
}
