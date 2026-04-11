package com.project.ecommerce.shipment.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record ShipmentSummaryResponse(
    UUID shipmentId,
    UUID orderId,
    String trackingNumber,
    String status,
    String carrierName,
    String modeOfShipment,
    LocalDate estimatedDeliveryDate,
    LocalDate actualDeliveryDate,
    LocalDateTime shippedAt,
    LocalDateTime deliveredAt,
    LocalDateTime createdAt
) {
}
