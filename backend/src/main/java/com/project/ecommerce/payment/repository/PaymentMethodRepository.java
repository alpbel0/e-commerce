package com.project.ecommerce.payment.repository;

import com.project.ecommerce.payment.domain.PaymentMethod;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, UUID> {
    Optional<PaymentMethod> findByCodeAndActiveTrue(String code);
}
