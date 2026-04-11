package com.project.ecommerce.order.dto;

import com.project.ecommerce.shipment.dto.ShipmentSummaryResponse;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderDetailResponse(
    UUID orderId,
    String incrementId,
    UUID userId,
    String customerEmail,
    UUID storeId,
    String storeName,
    String status,
    String paymentStatus,
    String paymentMethod,
    BigDecimal subtotal,
    BigDecimal discountAmount,
    BigDecimal shippingFee,
    BigDecimal taxAmount,
    BigDecimal grandTotal,
    String currency,
    String couponCode,
    String shippingAddressLine1,
    String shippingAddressLine2,
    String shippingCity,
    String shippingState,
    String shippingPostalCode,
    String shippingCountry,
    String customerPhone,
    String notes,
    LocalDateTime orderDate,
    List<OrderItemResponse> items,
    ShipmentSummaryResponse shipment
) {
}
