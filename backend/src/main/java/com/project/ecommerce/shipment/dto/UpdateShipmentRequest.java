package com.project.ecommerce.shipment.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record UpdateShipmentRequest(
    @NotBlank(message = "status is required")
    String status,
    String trackingNumber,
    String carrierName,
    String modeOfShipment,
    LocalDate estimatedDeliveryDate,
    LocalDate actualDeliveryDate
) {
}
