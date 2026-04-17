package com.project.ecommerce.payment.repository;

import com.project.ecommerce.payment.domain.Payment;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    @EntityGraph(attributePaths = {"order", "order.user", "order.store", "order.store.owner", "paymentMethod"})
    Optional<Payment> findByOrderId(UUID orderId);

    @EntityGraph(attributePaths = {"order", "order.user", "order.store", "order.store.owner", "paymentMethod"})
    Optional<Payment> findByProviderPaymentIntentId(String providerPaymentIntentId);
}
