package com.project.ecommerce.order.repository;

import com.project.ecommerce.order.domain.Order;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Page<Order> findByUserIdOrderByOrderDateDesc(UUID userId, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Page<Order> findByUserIdAndStatusOrderByOrderDateDesc(UUID userId, String status, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Page<Order> findByStoreOwnerIdOrderByOrderDateDesc(UUID ownerId, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Page<Order> findByStoreOwnerIdAndStatusOrderByOrderDateDesc(UUID ownerId, String status, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Page<Order> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Page<Order> findByStatusOrderByOrderDateDesc(String status, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"user", "store", "store.owner"})
    Optional<Order> findById(UUID id);
}
