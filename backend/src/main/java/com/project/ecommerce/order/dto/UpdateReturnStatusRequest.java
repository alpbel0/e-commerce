package com.project.ecommerce.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateReturnStatusRequest(
    @NotBlank(message = "status is required")
    String status,
    String note
) {
}
