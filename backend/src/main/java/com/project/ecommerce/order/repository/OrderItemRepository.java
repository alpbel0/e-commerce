package com.project.ecommerce.order.repository;

import com.project.ecommerce.order.domain.OrderItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    @EntityGraph(attributePaths = {"product", "product.store", "product.category"})
    List<OrderItem> findByOrderId(UUID orderId);

    @Override
    @EntityGraph(attributePaths = {"order", "order.user", "order.store", "order.store.owner", "product", "product.store", "product.category"})
    Optional<OrderItem> findById(UUID id);

    boolean existsByOrderUserIdAndOrderIdAndProductId(UUID userId, UUID orderId, UUID productId);
}
