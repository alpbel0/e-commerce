package com.project.ecommerce.shipment.service;

import com.project.ecommerce.shipment.domain.Shipment;
import com.project.ecommerce.shipment.dto.ShipmentSummaryResponse;
import org.springframework.stereotype.Component;

@Component
public class ShipmentMapper {

    public ShipmentSummaryResponse toSummaryResponse(Shipment shipment) {
        if (shipment == null) {
            return null;
        }
        return new ShipmentSummaryResponse(
            shipment.getId(),
            shipment.getOrder().getId(),
            shipment.getTrackingNumber(),
            shipment.getStatus(),
            shipment.getCarrierName(),
            shipment.getModeOfShipment(),
            shipment.getEstimatedDeliveryDate(),
            shipment.getActualDeliveryDate(),
            shipment.getShippedAt(),
            shipment.getDeliveredAt(),
            shipment.getCreatedAt()
        );
    }
}
