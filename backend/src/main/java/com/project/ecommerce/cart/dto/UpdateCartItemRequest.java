package com.project.ecommerce.cart.dto;

import jakarta.validation.constraints.PositiveOrZero;

public record UpdateCartItemRequest(
    @PositiveOrZero int quantity
) {
}
