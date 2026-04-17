package com.project.ecommerce.product.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ProductDetailResponse(
    UUID id,
    String sku,
    String title,
    String description,
    String brand,
    String currency,
    String sourceCountry,
    BigDecimal unitPrice,
    BigDecimal discountPercentage,
    BigDecimal costOfProduct,
    int stockQuantity,
    BigDecimal avgRating,
    int reviewCount,
    int totalSales,
    boolean active,
    UUID storeId,
    String storeName,
    UUID categoryId,
    String categoryName,
    List<String> imageUrls,
    List<String> tags,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
