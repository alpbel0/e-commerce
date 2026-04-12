package com.project.ecommerce.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record OrderSummaryResponse(
    UUID orderId,
    String incrementId,
    String customerEmail,
    UUID storeId,
    String storeName,
    String status,
    String paymentStatus,
    BigDecimal subtotal,
    BigDecimal discountAmount,
    BigDecimal grandTotal,
    String couponCode,
    LocalDateTime orderDate
) {
}
