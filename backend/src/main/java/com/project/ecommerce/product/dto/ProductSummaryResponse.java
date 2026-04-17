package com.project.ecommerce.product.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductSummaryResponse(
    UUID id,
    String sku,
    String title,
    String primaryImageUrl,
    String currency,
    String sourceCountry,
    BigDecimal unitPrice,
    BigDecimal discountPercentage,
    int stockQuantity,
    BigDecimal avgRating,
    int reviewCount,
    boolean active,
    UUID storeId,
    String storeName,
    UUID categoryId,
    String categoryName
) {
}
