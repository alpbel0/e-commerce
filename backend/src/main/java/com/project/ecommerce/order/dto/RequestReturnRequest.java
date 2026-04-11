package com.project.ecommerce.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record RequestReturnRequest(
    @Min(value = 1, message = "returnedQuantity must be at least 1")
    int returnedQuantity,
    @NotBlank(message = "reason is required")
    String reason
) {
}
