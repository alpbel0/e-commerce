package com.project.ecommerce.coupon.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record CreateCouponRequest(
    @NotNull UUID storeId,
    @NotBlank String code,
    @NotNull @DecimalMin(value = "0.01") @DecimalMax(value = "100.00") BigDecimal discountPercentage,
    LocalDateTime validUntil,
    Boolean active
) {
}
