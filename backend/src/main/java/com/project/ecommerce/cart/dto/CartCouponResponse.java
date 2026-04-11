package com.project.ecommerce.cart.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CartCouponResponse(
    UUID couponId,
    String code,
    BigDecimal discountPercentage
) {
}
