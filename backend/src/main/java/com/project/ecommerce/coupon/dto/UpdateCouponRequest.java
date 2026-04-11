package com.project.ecommerce.coupon.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record UpdateCouponRequest(
    UUID storeId,
    String code,
    @DecimalMin(value = "0.01") @DecimalMax(value = "100.00") BigDecimal discountPercentage,
    LocalDateTime validUntil,
    Boolean active
) {
}
