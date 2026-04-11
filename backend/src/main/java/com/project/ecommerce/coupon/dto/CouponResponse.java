package com.project.ecommerce.coupon.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record CouponResponse(
    UUID id,
    UUID storeId,
    String storeName,
    String code,
    BigDecimal discountPercentage,
    boolean active,
    LocalDateTime validUntil,
    LocalDateTime createdAt
) {
}
