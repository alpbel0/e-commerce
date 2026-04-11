package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;

public record CorporateSummaryResponse(
    BigDecimal totalRevenue,
    long totalOrders,
    long totalProducts,
    BigDecimal averageOrderValue,
    long totalReviews
) {
}
