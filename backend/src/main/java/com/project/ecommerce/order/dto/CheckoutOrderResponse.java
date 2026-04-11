package com.project.ecommerce.order.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CheckoutOrderResponse(
    UUID orderId,
    String incrementId,
    UUID storeId,
    String storeName,
    BigDecimal subtotal,
    BigDecimal discountAmount,
    BigDecimal grandTotal,
    String shipmentStatus
) {
}
