package com.project.ecommerce.payment.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.order.domain.Order;
import com.project.ecommerce.order.domain.OrderItem;
import com.project.ecommerce.order.repository.OrderItemRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.payment.domain.Payment;
import com.project.ecommerce.payment.domain.PaymentMethod;
import com.project.ecommerce.payment.domain.PaymentProvider;
import com.project.ecommerce.payment.domain.PaymentRefund;
import com.project.ecommerce.payment.domain.PaymentRefundStatus;
import com.project.ecommerce.payment.domain.PaymentStatus;
import com.project.ecommerce.payment.dto.CreateStripePaymentIntentRequest;
import com.project.ecommerce.payment.dto.CreateStripePaymentIntentResponse;
import com.project.ecommerce.payment.dto.CreateStripeRefundRequest;
import com.project.ecommerce.payment.dto.CreateStripeRefundResponse;
import com.project.ecommerce.payment.dto.SyncStripePaymentIntentRequest;
import com.project.ecommerce.payment.repository.PaymentMethodRepository;
import com.project.ecommerce.payment.repository.PaymentRefundRepository;
import com.project.ecommerce.payment.repository.PaymentRepository;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentService {

    private static final BigDecimal ZERO_MONEY = new BigDecimal("0.00");
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final StripePaymentService stripePaymentService;
    private final PaymentRepository paymentRepository;
    private final PaymentMethodRepository paymentMethodRepository;
    private final PaymentRefundRepository paymentRefundRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public PaymentService(
        StripePaymentService stripePaymentService,
        PaymentRepository paymentRepository,
        PaymentMethodRepository paymentMethodRepository,
        PaymentRefundRepository paymentRefundRepository,
        OrderRepository orderRepository,
        OrderItemRepository orderItemRepository,
        JdbcTemplate jdbcTemplate,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.stripePaymentService = stripePaymentService;
        this.paymentRepository = paymentRepository;
        this.paymentMethodRepository = paymentMethodRepository;
        this.paymentRefundRepository = paymentRefundRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CreateStripePaymentIntentResponse createStripePaymentIntent(CreateStripePaymentIntentRequest request) {
        var authenticatedUser = currentUserService.requireAuthenticatedUser();
        Order order = orderRepository.findById(request.orderId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!order.getUser().getId().equals(authenticatedUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only pay for your own order");
        }
        if (!"PENDING".equalsIgnoreCase(order.getPaymentStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order payment is not pending");
        }
        if (order.getGrandTotal().compareTo(ZERO_MONEY) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order amount must be greater than zero");
        }

        Payment existingPayment = paymentRepository.findByOrderId(order.getId()).orElse(null);
        if (existingPayment != null && existingPayment.getProviderPaymentIntentId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment intent already exists for this order");
        }

        PaymentMethod method = paymentMethodRepository.findByCodeAndActiveTrue("STRIPE_CARD")
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Stripe payment method is not configured"));
        PaymentIntent intent = stripePaymentService.createPaymentIntent(
            order.getId().toString(),
            money(order.getGrandTotal()),
            order.getCurrency()
        );

        Payment payment = existingPayment == null ? new Payment() : existingPayment;
        if (payment.getId() == null) {
            payment.setId(UUID.randomUUID());
            payment.setOrder(order);
        }
        payment.setPaymentMethod(method);
        payment.setProvider(PaymentProvider.STRIPE);
        payment.setProviderPaymentIntentId(intent.getId());
        payment.setStatus(mapPaymentIntentStatus(intent.getStatus()));
        payment.setAmount(money(order.getGrandTotal()));
        payment.setCurrency(order.getCurrency() == null ? "TRY" : order.getCurrency());
        paymentRepository.save(payment);

        order.setPaymentMethod("STRIPE_CARD");
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STRIPE_PAYMENT_INTENT_CREATED",
            Map.of("orderId", order.getId(), "paymentId", payment.getId(), "paymentIntentId", intent.getId())
        );

        return new CreateStripePaymentIntentResponse(
            payment.getId(),
            order.getId(),
            intent.getClientSecret(),
            payment.getAmount(),
            payment.getCurrency(),
            payment.getStatus().name()
        );
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public CreateStripeRefundResponse createStripeRefund(CreateStripeRefundRequest request) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        OrderItem orderItem = orderItemRepository.findById(request.orderItemId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order item not found"));
        Order order = orderItem.getOrder();
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE
            && !order.getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only refund orders for your own store");
        }
        if (!"RETURNED".equals(orderItem.getReturnStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe refund requires a completed return");
        }
        if (paymentRefundRepository.existsByOrderItemId(orderItem.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Refund already exists for this order item");
        }

        Payment payment = paymentRepository.findByOrderId(order.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found for order"));
        if (payment.getProviderPaymentIntentId() == null
            || (payment.getStatus() != PaymentStatus.SUCCEEDED && payment.getStatus() != PaymentStatus.PARTIALLY_REFUNDED)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only succeeded Stripe payments can be refunded");
        }

        BigDecimal refundAmount = calculateRefundAmount(orderItem);
        if (refundAmount.compareTo(ZERO_MONEY) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than zero");
        }
        BigDecimal alreadyRefunded = paymentRefundRepository.sumSucceededAmountByPaymentId(payment.getId());
        Refund refund = stripePaymentService.createRefund(
            payment.getProviderPaymentIntentId(),
            refundAmount,
            payment.getCurrency(),
            request.reason()
        );

        PaymentRefund paymentRefund = new PaymentRefund();
        paymentRefund.setId(UUID.randomUUID());
        paymentRefund.setPayment(payment);
        paymentRefund.setOrderItem(orderItem);
        paymentRefund.setProviderRefundId(refund.getId());
        paymentRefund.setAmount(refundAmount);
        paymentRefund.setStatus("succeeded".equalsIgnoreCase(refund.getStatus()) ? PaymentRefundStatus.SUCCEEDED : PaymentRefundStatus.PENDING);
        paymentRefund.setReason(request.reason());
        paymentRefundRepository.save(paymentRefund);

        if (paymentRefund.getStatus() == PaymentRefundStatus.SUCCEEDED) {
            BigDecimal totalRefunded = money(alreadyRefunded.add(refundAmount));
            payment.setStatus(totalRefunded.compareTo(payment.getAmount()) >= 0 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED);
            order.setPaymentStatus(payment.getStatus() == PaymentStatus.REFUNDED ? "REFUNDED" : "PAID");
            decreaseCustomerSpend(order, refundAmount);
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STRIPE_REFUND_CREATED",
            Map.of("orderId", order.getId(), "orderItemId", orderItem.getId(), "paymentId", payment.getId(), "refundId", refund.getId())
        );
        return new CreateStripeRefundResponse(
            paymentRefund.getId(),
            payment.getId(),
            orderItem.getId(),
            paymentRefund.getProviderRefundId(),
            paymentRefund.getAmount(),
            paymentRefund.getStatus().name()
        );
    }

    @Transactional
    public void handleStripeWebhook(String payload, String signatureHeader) {
        if (!stripePaymentService.isWebhookConfigured()) {
            log.warn("Ignoring Stripe webhook because webhook secret is not configured");
            return;
        }
        Event event = stripePaymentService.constructWebhookEvent(payload, signatureHeader);
        if ("payment_intent.succeeded".equals(event.getType()) || "payment_intent.payment_failed".equals(event.getType())) {
            Object stripeObject = event.getDataObjectDeserializer().getObject().orElse(null);
            if (stripeObject instanceof PaymentIntent paymentIntent) {
                updatePaymentFromIntent(paymentIntent);
            }
        }
    }

    @Transactional
    public void refundStripePaymentForCancelledOrder(Order order, String reason) {
        Payment payment = paymentRepository.findByOrderId(order.getId()).orElse(null);
        if (payment == null
            || payment.getProvider() != PaymentProvider.STRIPE
            || payment.getProviderPaymentIntentId() == null
            || payment.getStatus() != PaymentStatus.SUCCEEDED) {
            return;
        }

        BigDecimal alreadyRefunded = paymentRefundRepository.sumSucceededAmountByPaymentId(payment.getId());
        if (alreadyRefunded != null && money(alreadyRefunded).compareTo(money(payment.getAmount())) >= 0) {
            return;
        }

        BigDecimal refundAmount = money(order.getGrandTotal());
        if (refundAmount.compareTo(ZERO_MONEY) <= 0) {
            return;
        }

        Refund refund = stripePaymentService.createRefund(
            payment.getProviderPaymentIntentId(),
            refundAmount,
            payment.getCurrency(),
            reason
        );

        PaymentRefund paymentRefund = new PaymentRefund();
        paymentRefund.setId(UUID.randomUUID());
        paymentRefund.setPayment(payment);
        paymentRefund.setOrderItem(null);
        paymentRefund.setProviderRefundId(refund.getId());
        paymentRefund.setAmount(refundAmount);
        paymentRefund.setStatus("succeeded".equalsIgnoreCase(refund.getStatus()) ? PaymentRefundStatus.SUCCEEDED : PaymentRefundStatus.PENDING);
        paymentRefund.setReason(reason);
        paymentRefundRepository.save(paymentRefund);

        if (paymentRefund.getStatus() == PaymentRefundStatus.SUCCEEDED) {
            payment.setStatus(PaymentStatus.REFUNDED);
            order.setPaymentStatus("REFUNDED");
            decreaseCustomerSpend(order, refundAmount);
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STRIPE_REFUND_CREATED_FOR_CANCELLED_ORDER",
            Map.of(
                "orderId", order.getId(),
                "paymentId", payment.getId(),
                "refundId", refund.getId(),
                "amount", refundAmount
            )
        );
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public void syncStripePaymentIntent(SyncStripePaymentIntentRequest request) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();

        Payment payment = paymentRepository.findByProviderPaymentIntentId(request.paymentIntentId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        Order order = payment.getOrder();
        if (!order.getUser().getId().equals(authenticatedUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only sync your own payments");
        }
        if (request.orderId() != null && !order.getId().equals(request.orderId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order does not match payment intent");
        }

        PaymentStatus previousStatus = payment.getStatus();
        PaymentStatus status = mapPaymentIntentStatus(request.status());
        payment.setStatus(status);
        payment.setProviderChargeId(blankToNull(request.chargeId()));
        payment.setFailureMessage(blankToNull(request.failureMessage()));

        if (status == PaymentStatus.SUCCEEDED) {
            order.setPaymentStatus("PAID");
            if (isFirstSuccessfulPayment(previousStatus)) {
                increaseCustomerSpend(order);
            }
        } else if (status == PaymentStatus.FAILED) {
            order.setPaymentStatus("FAILED");
            releaseStockForFailedPayment(order, previousStatus);
        } else if (status == PaymentStatus.REQUIRES_ACTION) {
            order.setPaymentStatus("PENDING");
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STRIPE_PAYMENT_SYNCED",
            Map.of(
                "orderId", order.getId(),
                "paymentId", payment.getId(),
                "paymentIntentId", request.paymentIntentId(),
                "status", status.name()
            )
        );
    }

    private void updatePaymentFromIntent(PaymentIntent intent) {
        Payment payment = paymentRepository.findByProviderPaymentIntentId(intent.getId()).orElse(null);
        if (payment == null) {
            return;
        }
        PaymentStatus previousStatus = payment.getStatus();
        PaymentStatus status = mapPaymentIntentStatus(intent.getStatus());
        payment.setStatus(status);
        payment.setProviderChargeId(intent.getLatestCharge());
        if (intent.getLastPaymentError() != null) {
            payment.setFailureMessage(intent.getLastPaymentError().getMessage());
        }
        Order order = payment.getOrder();
        if (status == PaymentStatus.SUCCEEDED) {
            order.setPaymentStatus("PAID");
            if (isFirstSuccessfulPayment(previousStatus)) {
                increaseCustomerSpend(order);
            }
        } else if (status == PaymentStatus.FAILED) {
            order.setPaymentStatus("FAILED");
            releaseStockForFailedPayment(order, previousStatus);
        }
    }

    private boolean isFirstSuccessfulPayment(PaymentStatus previousStatus) {
        return previousStatus != PaymentStatus.SUCCEEDED
            && previousStatus != PaymentStatus.PARTIALLY_REFUNDED
            && previousStatus != PaymentStatus.REFUNDED;
    }

    private void increaseCustomerSpend(Order order) {
        jdbcTemplate.update(
            "update customer_profiles set total_spend = coalesce(total_spend, 0) + ? where user_id = ?",
            money(order.getGrandTotal()),
            order.getUser().getId()
        );
    }

    private void decreaseCustomerSpend(Order order, BigDecimal refundAmount) {
        jdbcTemplate.update(
            "update customer_profiles set total_spend = greatest(coalesce(total_spend, 0) - ?, 0) where user_id = ?",
            money(refundAmount),
            order.getUser().getId()
        );
    }

    private void releaseStockForFailedPayment(Order order, PaymentStatus previousStatus) {
        if (previousStatus == PaymentStatus.FAILED || "CANCELLED".equals(order.getStatus())) {
            return;
        }
        for (OrderItem orderItem : orderItemRepository.findByOrderId(order.getId())) {
            var product = orderItem.getProduct();
            product.setStockQuantity(product.getStockQuantity() + orderItem.getQuantity());
        }
        order.setStatus("CANCELLED");
    }

    private PaymentStatus mapPaymentIntentStatus(String stripeStatus) {
        if ("succeeded".equalsIgnoreCase(stripeStatus)) {
            return PaymentStatus.SUCCEEDED;
        }
        if ("requires_action".equalsIgnoreCase(stripeStatus) || "requires_confirmation".equalsIgnoreCase(stripeStatus)) {
            return PaymentStatus.REQUIRES_ACTION;
        }
        if ("requires_payment_method".equalsIgnoreCase(stripeStatus) || "canceled".equalsIgnoreCase(stripeStatus)) {
            return PaymentStatus.FAILED;
        }
        return PaymentStatus.PENDING;
    }

    private BigDecimal calculateRefundAmount(OrderItem orderItem) {
        BigDecimal grossLineAmount = money(orderItem.getUnitPriceAtPurchase().multiply(BigDecimal.valueOf(orderItem.getQuantity())));
        BigDecimal lineNetPaid = money(grossLineAmount.subtract(
            orderItem.getDiscountApplied() == null ? ZERO_MONEY : orderItem.getDiscountApplied()
        ).max(BigDecimal.ZERO));
        BigDecimal refundablePerUnit = lineNetPaid.divide(BigDecimal.valueOf(orderItem.getQuantity()), 2, RoundingMode.HALF_UP);
        return money(refundablePerUnit.multiply(BigDecimal.valueOf(orderItem.getReturnedQuantity() == null ? 0 : orderItem.getReturnedQuantity())));
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
