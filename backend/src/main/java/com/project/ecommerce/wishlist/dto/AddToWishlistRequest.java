package com.project.ecommerce.wishlist.dto;

import jakarta.validation.constraints.Min;
import java.util.UUID;

public record AddToWishlistRequest(
    UUID productId,
    @Min(value = 1, message = "Quantity must be at least 1") Integer quantity
) {
    public AddToWishlistRequest(UUID productId) {
        this(productId, 1);
    }
}
