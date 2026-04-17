package com.project.ecommerce.shipment.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.shipment.domain.Shipment;
import com.project.ecommerce.shipment.dto.ShipmentSummaryResponse;
import com.project.ecommerce.shipment.dto.UpdateShipmentRequest;
import com.project.ecommerce.shipment.repository.ShipmentRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ShipmentService {

    private static final Set<String> ALLOWED_SHIPMENT_STATUSES = Set.of(
        "PENDING",
        "PICKED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "FAILED",
        "RETURNED"
    );

    private final ShipmentRepository shipmentRepository;
    private final CurrentUserService currentUserService;
    private final ShipmentMapper shipmentMapper;
    private final AuditLogService auditLogService;

    public ShipmentService(
        ShipmentRepository shipmentRepository,
        CurrentUserService currentUserService,
        ShipmentMapper shipmentMapper,
        AuditLogService auditLogService
    ) {
        this.shipmentRepository = shipmentRepository;
        this.currentUserService = currentUserService;
        this.shipmentMapper = shipmentMapper;
        this.auditLogService = auditLogService;
    }

    @PreAuthorize("hasAnyRole('INDIVIDUAL', 'CORPORATE', 'ADMIN')")
    public ShipmentSummaryResponse getShipment(UUID shipmentId) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shipment not found"));
        authorizeShipmentAccess(shipment);
        return shipmentMapper.toSummaryResponse(shipment);
    }

    @PreAuthorize("hasAnyRole('INDIVIDUAL', 'CORPORATE', 'ADMIN')")
    public ShipmentSummaryResponse getShipmentByOrderId(UUID orderId) {
        Shipment shipment = shipmentRepository.findByOrderId(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shipment not found"));
        authorizeShipmentAccess(shipment);
        return shipmentMapper.toSummaryResponse(shipment);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public ShipmentSummaryResponse updateShipment(UUID shipmentId, UpdateShipmentRequest request) {
        Shipment shipment = shipmentRepository.findById(shipmentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shipment not found"));
        authorizeShipmentManagement(shipment);

        String normalizedStatus = normalizeStatus(request.status());
        if (!ALLOWED_SHIPMENT_STATUSES.contains(normalizedStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported shipment status");
        }

        String previousStatus = shipment.getStatus();
        shipment.setStatus(normalizedStatus);
        shipment.setTrackingNumber(blankToNull(request.trackingNumber()));
        shipment.setCarrierName(blankToNull(request.carrierName()));
        shipment.setModeOfShipment(blankToNull(request.modeOfShipment()));
        shipment.setEstimatedDeliveryDate(request.estimatedDeliveryDate());
        shipment.setActualDeliveryDate(request.actualDeliveryDate());

        if ("IN_TRANSIT".equals(normalizedStatus) && shipment.getShippedAt() == null) {
            shipment.setShippedAt(LocalDateTime.now());
        }
        if ("DELIVERED".equals(normalizedStatus)) {
            if (shipment.getShippedAt() == null) {
                shipment.setShippedAt(LocalDateTime.now());
            }
            if (shipment.getDeliveredAt() == null) {
                shipment.setDeliveredAt(LocalDateTime.now());
            }
            if (shipment.getActualDeliveryDate() == null) {
                shipment.setActualDeliveryDate(LocalDate.now());
            }
        } else if ("FAILED".equals(normalizedStatus) || "RETURNED".equals(normalizedStatus)) {
            shipment.setDeliveredAt(null);
            shipment.setActualDeliveryDate(null);
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "SHIPMENT_UPDATED",
            java.util.Map.of(
                "shipmentId", shipment.getId(),
                "orderId", shipment.getOrder().getId(),
                "oldStatus", previousStatus,
                "newStatus", normalizedStatus
            )
        );
        return shipmentMapper.toSummaryResponse(shipment);
    }

    private void authorizeShipmentAccess(Shipment shipment) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.INDIVIDUAL
            && shipment.getOrder().getUser().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE
            && shipment.getOrder().getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private void authorizeShipmentManagement(Shipment shipment) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE
            && shipment.getOrder().getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private String normalizeStatus(String status) {
        return status.trim().toUpperCase();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
