package com.project.ecommerce.wishlist.dto;

import jakarta.validation.constraints.Min;

public record UpdateWishlistQuantityRequest(
    @Min(value = 1, message = "Quantity must be at least 1") int quantity
) {
}
