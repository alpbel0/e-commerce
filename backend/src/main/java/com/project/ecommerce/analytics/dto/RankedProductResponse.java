package com.project.ecommerce.analytics.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record RankedProductResponse(
    UUID productId,
    String productTitle,
    UUID storeId,
    String storeName,
    long totalQuantitySold,
    BigDecimal totalRevenue
) {
}
