package com.project.ecommerce.payment.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateStripePaymentIntentRequest(
    @NotNull UUID orderId
) {
}
