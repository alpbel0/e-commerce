package com.project.ecommerce.payment.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record SyncStripePaymentIntentRequest(
    UUID orderId,
    @NotBlank String paymentIntentId,
    @NotBlank String status,
    String chargeId,
    String failureMessage
) {
}
