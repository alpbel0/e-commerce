package com.project.ecommerce.product.dto;

import jakarta.validation.constraints.Min;

public record UpdateProductStockRequest(
    @Min(value = 0, message = "stockQuantity must be non-negative")
    int stockQuantity
) {
}
