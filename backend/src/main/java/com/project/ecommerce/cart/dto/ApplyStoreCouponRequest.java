package com.project.ecommerce.cart.dto;

import jakarta.validation.constraints.NotBlank;

public record ApplyStoreCouponRequest(
    @NotBlank String code
) {
}
