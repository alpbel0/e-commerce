package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record RankedStoreResponse(
    UUID storeId,
    String storeName,
    long totalOrders,
    BigDecimal totalRevenue
) {
}
