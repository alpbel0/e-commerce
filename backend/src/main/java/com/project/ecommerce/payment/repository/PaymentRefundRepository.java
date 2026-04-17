package com.project.ecommerce.payment.repository;

import com.project.ecommerce.payment.domain.PaymentRefund;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, UUID> {

    boolean existsByOrderItemId(UUID orderItemId);

    @Query("""
        select coalesce(sum(r.amount), 0)
        from PaymentRefund r
        where r.payment.id = :paymentId
          and r.status = com.project.ecommerce.payment.domain.PaymentRefundStatus.SUCCEEDED
    """)
    BigDecimal sumSucceededAmountByPaymentId(UUID paymentId);
}
