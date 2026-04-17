package com.project.ecommerce.payment.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateStripePaymentIntentResponse(
    UUID paymentId,
    UUID orderId,
    String clientSecret,
    BigDecimal amount,
    String currency,
    String status
) {
}
