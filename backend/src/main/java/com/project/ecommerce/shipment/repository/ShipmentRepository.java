package com.project.ecommerce.shipment.repository;

import com.project.ecommerce.shipment.domain.Shipment;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {

    @EntityGraph(attributePaths = {"order", "order.user", "order.store", "order.store.owner"})
    Optional<Shipment> findByOrderId(UUID orderId);

    @Override
    @EntityGraph(attributePaths = {"order", "order.user", "order.store", "order.store.owner"})
    Optional<Shipment> findById(UUID id);
}
