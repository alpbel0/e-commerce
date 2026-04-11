package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;

public record AdminSummaryResponse(
    BigDecimal totalRevenue,
    long totalOrders,
    long totalCustomers,
    long totalStores,
    long totalProducts
) {
}
