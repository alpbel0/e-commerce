package com.project.ecommerce.cart.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

public record AddCartItemRequest(
    @NotNull UUID productId,
    @Positive int quantity
) {
}
