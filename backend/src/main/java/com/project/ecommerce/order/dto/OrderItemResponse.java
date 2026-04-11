package com.project.ecommerce.order.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponse(
    UUID orderItemId,
    UUID productId,
    String sku,
    String title,
    int quantity,
    BigDecimal unitPriceAtPurchase,
    BigDecimal discountApplied,
    BigDecimal subtotal,
    String returnStatus,
    String returnReason,
    String returnUpdateNote,
    Integer returnedQuantity,
    BigDecimal refundableAmount
) {
}
