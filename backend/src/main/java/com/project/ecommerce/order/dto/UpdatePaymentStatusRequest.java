package com.project.ecommerce.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePaymentStatusRequest(
    @NotBlank(message = "paymentStatus is required")
    String paymentStatus
) {
}
