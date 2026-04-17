package com.project.ecommerce.payment.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateStripeRefundResponse(
    UUID refundId,
    UUID paymentId,
    UUID orderItemId,
    String providerRefundId,
    BigDecimal amount,
    String status
) {
}
