package com.project.ecommerce.shipment.web;

import com.project.ecommerce.shipment.dto.ShipmentSummaryResponse;
import com.project.ecommerce.shipment.dto.UpdateShipmentRequest;
import com.project.ecommerce.shipment.service.ShipmentService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {

    private final ShipmentService shipmentService;

    public ShipmentController(ShipmentService shipmentService) {
        this.shipmentService = shipmentService;
    }

    @GetMapping("/{shipmentId}")
    public ShipmentSummaryResponse getShipment(@PathVariable UUID shipmentId) {
        return shipmentService.getShipment(shipmentId);
    }

    @GetMapping("/order/{orderId}")
    public ShipmentSummaryResponse getShipmentByOrderId(@PathVariable UUID orderId) {
        return shipmentService.getShipmentByOrderId(orderId);
    }

    @PatchMapping("/{shipmentId}")
    public ShipmentSummaryResponse updateShipment(
        @PathVariable UUID shipmentId,
        @Valid @RequestBody UpdateShipmentRequest request
    ) {
        return shipmentService.updateShipment(shipmentId, request);
    }
}
