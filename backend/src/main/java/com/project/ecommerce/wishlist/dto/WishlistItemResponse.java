package com.project.ecommerce.wishlist.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record WishlistItemResponse(
    UUID id,
    String title,
    String imageUrl,
    String currency,
    BigDecimal unitPrice,
    int quantity,
    String storeName,
    String categoryName,
    String discountPercentage,
    BigDecimal avgRating,
    int reviewCount,
    boolean active
) {
}
