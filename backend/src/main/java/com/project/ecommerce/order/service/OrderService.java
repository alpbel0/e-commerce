package com.project.ecommerce.order.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.cart.domain.Cart;
import com.project.ecommerce.cart.domain.CartItem;
import com.project.ecommerce.cart.domain.CartStoreCoupon;
import com.project.ecommerce.cart.repository.CartItemRepository;
import com.project.ecommerce.cart.repository.CartRepository;
import com.project.ecommerce.cart.repository.CartStoreCouponRepository;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.order.domain.Order;
import com.project.ecommerce.order.domain.OrderItem;
import com.project.ecommerce.order.dto.CheckoutOrderResponse;
import com.project.ecommerce.order.dto.CheckoutRequest;
import com.project.ecommerce.order.dto.CheckoutResponse;
import com.project.ecommerce.order.dto.OrderDetailResponse;
import com.project.ecommerce.order.dto.OrderItemResponse;
import com.project.ecommerce.order.dto.OrderSummaryResponse;
import com.project.ecommerce.order.dto.RequestReturnRequest;
import com.project.ecommerce.order.dto.UpdateOrderStatusRequest;
import com.project.ecommerce.order.dto.UpdatePaymentStatusRequest;
import com.project.ecommerce.order.dto.UpdateReturnStatusRequest;
import com.project.ecommerce.order.repository.OrderItemRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.notification.service.NotificationService;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.shipment.domain.Shipment;
import com.project.ecommerce.shipment.dto.ShipmentSummaryResponse;
import com.project.ecommerce.shipment.repository.ShipmentRepository;
import com.project.ecommerce.shipment.service.ShipmentMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final BigDecimal ZERO_MONEY = new BigDecimal("0.00");
    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of("PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED");
    private static final Set<String> ALLOWED_PAYMENT_STATUSES = Set.of("PENDING", "PAID", "FAILED", "REFUNDED");
    private static final Set<String> ALLOWED_RETURN_DECISIONS = Set.of("RETURNED", "REJECTED");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ShipmentRepository shipmentRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final CartStoreCouponRepository cartStoreCouponRepository;
    private final ProductRepository productRepository;
    private final AppUserRepository appUserRepository;
    private final CurrentUserService currentUserService;
    private final ShipmentMapper shipmentMapper;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    public OrderService(
        OrderRepository orderRepository,
        OrderItemRepository orderItemRepository,
        ShipmentRepository shipmentRepository,
        CartRepository cartRepository,
        CartItemRepository cartItemRepository,
        CartStoreCouponRepository cartStoreCouponRepository,
        ProductRepository productRepository,
        AppUserRepository appUserRepository,
        CurrentUserService currentUserService,
        ShipmentMapper shipmentMapper,
        NotificationService notificationService,
        AuditLogService auditLogService
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.shipmentRepository = shipmentRepository;
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.cartStoreCouponRepository = cartStoreCouponRepository;
        this.productRepository = productRepository;
        this.appUserRepository = appUserRepository;
        this.currentUserService = currentUserService;
        this.shipmentMapper = shipmentMapper;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CheckoutResponse checkout(CheckoutRequest request) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.INDIVIDUAL) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Checkout is available only for individual users");
        }

        AppUser currentUser = currentUserService.requireCurrentAppUser();
        Cart cart = cartRepository.findByUserId(currentUser.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart is empty"));

        List<CartItem> cartItems = cartItemRepository.findByCartId(cart.getId());
        if (cartItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart is empty");
        }

        // Idempotency check: if same idempotency key exists and order is not cancelled, return existing orders
        String idempotencyKey = blankToNull(request.idempotencyKey());
        if (idempotencyKey != null) {
            List<Order> existingOrders = orderRepository.findAllByIdempotencyKeyAndUserId(idempotencyKey, currentUser.getId());
            if (!existingOrders.isEmpty()) {
                Order firstOrder = existingOrders.getFirst();
                if (!"CANCELLED".equals(firstOrder.getStatus())) {
                    List<CheckoutOrderResponse> idempotentResponse = existingOrders.stream()
                        .map(order -> {
                            Shipment shipment = shipmentRepository.findByOrderId(order.getId()).orElse(null);
                            return new CheckoutOrderResponse(
                                order.getId(),
                                order.getIncrementId(),
                                order.getStore().getId(),
                                order.getStore().getName(),
                                order.getSubtotal(),
                                order.getDiscountAmount(),
                                order.getGrandTotal(),
                                order.getCurrency(),
                                shipment == null ? null : shipment.getStatus()
                            );
                        })
                        .toList();
                    BigDecimal total = existingOrders.stream()
                        .map(Order::getGrandTotal)
                        .reduce(ZERO_MONEY, BigDecimal::add);
                    return new CheckoutResponse(idempotentResponse, idempotentResponse.size(), total);
                }
            }
        }

        Map<UUID, CartStoreCoupon> couponsByStoreId = new LinkedHashMap<>();
        for (CartStoreCoupon cartCoupon : cartStoreCouponRepository.findByCartId(cart.getId())) {
            couponsByStoreId.put(cartCoupon.getStore().getId(), cartCoupon);
        }

        Map<UUID, List<CartItem>> itemsByStoreId = new LinkedHashMap<>();
        for (CartItem cartItem : cartItems) {
            Product product = cartItem.getProduct();
            validateCheckoutItem(product, cartItem.getQuantity());
            itemsByStoreId.computeIfAbsent(product.getStore().getId(), ignored -> new ArrayList<>()).add(cartItem);
        }

        List<CheckoutOrderResponse> createdOrders = new ArrayList<>();
        BigDecimal totalGrandTotal = ZERO_MONEY;

        for (var entry : itemsByStoreId.entrySet().stream()
            .sorted(Comparator.comparing(item -> item.getValue().getFirst().getProduct().getStore().getName()))
            .toList()) {
            List<CartItem> storeItems = entry.getValue();
            var store = storeItems.getFirst().getProduct().getStore();
            CartStoreCoupon storeCoupon = couponsByStoreId.get(store.getId());

            BigDecimal subtotal = money(storeItems.stream()
                .map(this::lineSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
            BigDecimal discountAmount = storeCoupon == null
                ? ZERO_MONEY
                : calculateDiscount(subtotal, storeCoupon.getCoupon().getDiscountPercentage());
            BigDecimal grandTotal = money(subtotal.subtract(discountAmount).max(BigDecimal.ZERO));
            String currency = resolveStoreCurrency(storeItems);

            Order order = new Order();
            order.setId(UUID.randomUUID());
            order.setUser(currentUser);
            order.setStore(store);
            order.setIncrementId(generateIncrementId());
            order.setOrderDate(LocalDateTime.now());
            order.setStatus("PENDING");
            order.setPaymentStatus("PENDING");
            order.setPaymentMethod(request.paymentMethod().name());
            order.setSubtotal(subtotal);
            order.setDiscountAmount(discountAmount);
            order.setShippingFee(ZERO_MONEY);
            order.setTaxAmount(ZERO_MONEY);
            order.setGrandTotal(grandTotal);
            order.setCurrency(currency);
            order.setCouponCode(storeCoupon == null ? null : storeCoupon.getCoupon().getCode());
            order.setIdempotencyKey(idempotencyKey);
            order.setShippingAddressLine1(request.shippingAddressLine1().trim());
            order.setShippingAddressLine2(blankToNull(request.shippingAddressLine2()));
            order.setShippingCity(request.shippingCity().trim());
            order.setShippingState(blankToNull(request.shippingState()));
            order.setShippingPostalCode(blankToNull(request.shippingPostalCode()));
            order.setShippingCountry(request.shippingCountry().trim());
            order.setCustomerEmail(currentUser.getEmail());
            order.setCustomerPhone(blankToNull(request.customerPhone()));
            order.setNotes(blankToNull(request.notes()));
            orderRepository.save(order);

            Map<UUID, BigDecimal> discountByProductId = distributeOrderDiscount(storeItems, discountAmount);

            for (CartItem cartItem : storeItems) {
                Product product = cartItem.getProduct();
                BigDecimal itemDiscount = discountByProductId.getOrDefault(product.getId(), ZERO_MONEY);
                BigDecimal lineNetSubtotal = money(lineSubtotal(cartItem).subtract(itemDiscount).max(BigDecimal.ZERO));

                OrderItem orderItem = new OrderItem();
                orderItem.setId(UUID.randomUUID());
                orderItem.setOrder(order);
                orderItem.setProduct(product);
                orderItem.setQuantity(cartItem.getQuantity());
                orderItem.setUnitPriceAtPurchase(money(product.getUnitPrice()));
                orderItem.setDiscountApplied(itemDiscount);
                orderItem.setSubtotal(lineNetSubtotal);
                orderItem.setReturnStatus("NONE");
                orderItem.setReturnReason(null);
                orderItem.setReturnUpdateNote(null);
                orderItem.setReturnedQuantity(0);
                orderItemRepository.save(orderItem);

                reserveStock(product, cartItem.getQuantity());
            }

            Shipment shipment = new Shipment();
            shipment.setId(UUID.randomUUID());
            shipment.setOrder(order);
            shipment.setStatus("PENDING");
            shipmentRepository.save(shipment);

            createdOrders.add(new CheckoutOrderResponse(
                order.getId(),
                order.getIncrementId(),
                store.getId(),
                store.getName(),
                order.getSubtotal(),
                order.getDiscountAmount(),
                order.getGrandTotal(),
                order.getCurrency(),
                shipment.getStatus()
            ));

            notificationService.createOrderNotification(
                currentUser,
                order,
                "ORDER_CREATED",
                "Order confirmed: " + order.getIncrementId(),
                "Your order has been created for store " + store.getName() + "."
            );
            notificationService.createOrderNotification(
                store.getOwner(),
                order,
                "NEW_ORDER",
                "New order received: " + order.getIncrementId(),
                "A new order has been placed for your store " + store.getName() + "."
            );

            totalGrandTotal = totalGrandTotal.add(grandTotal);
        }

        cartItemRepository.deleteAll(cartItems);
        cartStoreCouponRepository.deleteAll(cartStoreCouponRepository.findByCartId(cart.getId()));

        return new CheckoutResponse(createdOrders, createdOrders.size(), money(totalGrandTotal));
    }

    @PreAuthorize("hasAnyRole('INDIVIDUAL', 'CORPORATE', 'ADMIN')")
    public ApiPageResponse<OrderSummaryResponse> listOrders(Integer page, Integer size, String sort, String status, UUID storeId) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        Pageable pageable = buildPageable(page, size, sort);
        String normalizedStatus = status == null || status.isBlank() ? null : normalizeStatus(status);
        Page<Order> resultPage = switch (authenticatedUser.getActiveRole()) {
            case INDIVIDUAL -> listIndividualOrders(authenticatedUser.getUserId(), pageable, normalizedStatus, storeId);
            case CORPORATE -> listCorporateOrders(authenticatedUser.getUserId(), pageable, normalizedStatus, storeId);
            case ADMIN -> listAdminOrders(pageable, normalizedStatus, storeId);
        };

        var items = resultPage.stream().map(this::toSummaryResponse).toList();
        return new ApiPageResponse<>(items, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    @PreAuthorize("hasAnyRole('INDIVIDUAL', 'CORPORATE', 'ADMIN')")
    public OrderDetailResponse getOrderDetail(UUID orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        authorizeOrderAccess(order);

        List<OrderItemResponse> items = orderItemRepository.findByOrderId(order.getId()).stream()
            .map(this::toOrderItemResponse)
            .toList();
        ShipmentSummaryResponse shipment = shipmentRepository.findByOrderId(orderId)
            .map(shipmentMapper::toSummaryResponse)
            .orElse(null);

        return new OrderDetailResponse(
            order.getId(),
            order.getIncrementId(),
            order.getUser().getId(),
            order.getCustomerEmail(),
            order.getStore().getId(),
            order.getStore().getName(),
            order.getStatus(),
            order.getPaymentStatus(),
            order.getPaymentMethod(),
            money(order.getSubtotal()),
            money(order.getDiscountAmount() == null ? ZERO_MONEY : order.getDiscountAmount()),
            money(order.getShippingFee() == null ? ZERO_MONEY : order.getShippingFee()),
            money(order.getTaxAmount() == null ? ZERO_MONEY : order.getTaxAmount()),
            money(order.getGrandTotal()),
            order.getCurrency(),
            order.getCouponCode(),
            order.getShippingAddressLine1(),
            order.getShippingAddressLine2(),
            order.getShippingCity(),
            order.getShippingState(),
            order.getShippingPostalCode(),
            order.getShippingCountry(),
            order.getCustomerPhone(),
            order.getNotes(),
            order.getOrderDate(),
            items,
            shipment
        );
    }

    @PreAuthorize("hasAnyRole('INDIVIDUAL', 'CORPORATE', 'ADMIN')")
    public ShipmentSummaryResponse getOrderShipment(UUID orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        authorizeOrderAccess(order);
        Shipment shipment = shipmentRepository.findByOrderId(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shipment not found"));
        return shipmentMapper.toSummaryResponse(shipment);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public OrderDetailResponse cancelOrder(UUID orderId) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.INDIVIDUAL) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only individual users can cancel their own orders");
        }

        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (!order.getUser().getId().equals(authenticatedUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own orders");
        }
        if (!"PENDING".equals(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending orders can be cancelled");
        }

        String previousStatus = order.getStatus();
        order.setStatus("CANCELLED");

        // Restore stock for each order item
        for (OrderItem orderItem : orderItemRepository.findByOrderId(order.getId())) {
            productRepository.incrementStock(orderItem.getProduct().getId(), orderItem.getQuantity());
        }

        // Mark shipment as failed
        shipmentRepository.findByOrderId(order.getId()).ifPresent(shipment -> shipment.setStatus("FAILED"));

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "ORDER_CANCELLED",
            java.util.Map.of(
                "orderId", order.getId(),
                "previousStatus", previousStatus
            )
        );
        return getOrderDetail(orderId);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public OrderItemResponse requestReturn(UUID orderItemId, RequestReturnRequest request) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.INDIVIDUAL) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only individual users can request returns");
        }

        OrderItem orderItem = orderItemRepository.findById(orderItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order item not found"));
        if (!orderItem.getOrder().getUser().getId().equals(authenticatedUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only request returns for your own order items");
        }
        if (!"DELIVERED".equals(orderItem.getOrder().getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return requests require delivered orders");
        }
        if (!"NONE".equals(orderItem.getReturnStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Return request already exists for this order item");
        }
        if (request.returnedQuantity() > orderItem.getQuantity()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Returned quantity cannot exceed purchased quantity");
        }

        orderItem.setReturnStatus("REQUESTED");
        orderItem.setReturnedQuantity(request.returnedQuantity());
        orderItem.setReturnReason(request.reason().trim());
        orderItem.setReturnUpdateNote(null);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "RETURN_REQUESTED",
            java.util.Map.of(
                "orderItemId", orderItem.getId(),
                "orderId", orderItem.getOrder().getId(),
                "returnedQuantity", request.returnedQuantity()
            )
        );
        return toOrderItemResponse(orderItem);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public OrderItemResponse updateReturnStatus(UUID orderItemId, UpdateReturnStatusRequest request) {
        OrderItem orderItem = orderItemRepository.findById(orderItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order item not found"));
        authorizeOrderManagement(orderItem.getOrder());
        if (!"REQUESTED".equals(orderItem.getReturnStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Return status can only be updated from REQUESTED state");
        }

        String nextStatus = normalizeReturnStatus(request.status());
        if (!ALLOWED_RETURN_DECISIONS.contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported return status");
        }

        orderItem.setReturnStatus(nextStatus);
        orderItem.setReturnUpdateNote(blankToNull(request.note()));
        if ("RETURNED".equals(nextStatus)) {
            Product product = orderItem.getProduct();
            product.setStockQuantity(product.getStockQuantity() + orderItem.getReturnedQuantity());
            BigDecimal refundAmount = calculateRefundAmount(orderItem);
            // Deduct refund from user's totalSpend
            AppUser orderUser = orderItem.getOrder().getUser();
            orderUser.setTotalSpend(money(orderUser.getTotalSpend().subtract(refundAmount).max(BigDecimal.ZERO)));
            appUserRepository.save(orderUser);
            auditLogService.log(
                currentUserService.requireCurrentAppUser(),
                "RETURN_COMPLETED",
                java.util.Map.of(
                    "orderItemId", orderItem.getId(),
                    "orderId", orderItem.getOrder().getId(),
                    "returnedQuantity", orderItem.getReturnedQuantity(),
                    "refundAmount", refundAmount
                )
            );
        } else {
            auditLogService.log(
                currentUserService.requireCurrentAppUser(),
                "RETURN_REJECTED",
                java.util.Map.of(
                    "orderItemId", orderItem.getId(),
                    "orderId", orderItem.getOrder().getId(),
                    "returnedQuantity", orderItem.getReturnedQuantity()
                )
            );
        }
        return toOrderItemResponse(orderItem);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public OrderDetailResponse updateOrderStatus(UUID orderId, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        authorizeOrderManagement(order);

        String nextStatus = normalizeStatus(request.status());
        if (!ALLOWED_ORDER_STATUSES.contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported order status");
        }
        if ("CANCELLED".equals(order.getStatus()) && !"CANCELLED".equals(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled orders cannot be re-opened");
        }
        if ("DELIVERED".equals(order.getStatus()) && "CANCELLED".equals(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Delivered orders cannot be cancelled");
        }

        if (!"CANCELLED".equals(order.getStatus()) && "CANCELLED".equals(nextStatus)) {
            for (OrderItem orderItem : orderItemRepository.findByOrderId(order.getId())) {
                Product product = orderItem.getProduct();
                product.setStockQuantity(product.getStockQuantity() + orderItem.getQuantity());
            }
            shipmentRepository.findByOrderId(order.getId()).ifPresent(shipment -> shipment.setStatus("FAILED"));
        }

        String previousStatus = order.getStatus();
        order.setStatus(nextStatus);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "ORDER_STATUS_UPDATED",
            java.util.Map.of(
                "orderId", order.getId(),
                "oldStatus", previousStatus,
                "newStatus", nextStatus
            )
        );
        return getOrderDetail(orderId);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public OrderDetailResponse updatePaymentStatus(UUID orderId, UpdatePaymentStatusRequest request) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        authorizeOrderManagement(order);

        String nextPaymentStatus = normalizeStatus(request.paymentStatus());
        if (!ALLOWED_PAYMENT_STATUSES.contains(nextPaymentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported payment status");
        }

        String previousPaymentStatus = order.getPaymentStatus();
        order.setPaymentStatus(nextPaymentStatus);

        // On payment success: add to user's totalSpend
        if ("PAID".equals(nextPaymentStatus) && !"PAID".equals(previousPaymentStatus)) {
            AppUser orderUser = order.getUser();
            orderUser.setTotalSpend(money(orderUser.getTotalSpend().add(order.getGrandTotal())));
            appUserRepository.save(orderUser);
        }

        // On payment failure: restore reserved stock
        if ("FAILED".equals(nextPaymentStatus) && !"FAILED".equals(previousPaymentStatus)) {
            for (OrderItem orderItem : orderItemRepository.findByOrderId(order.getId())) {
                productRepository.incrementStock(orderItem.getProduct().getId(), orderItem.getQuantity());
            }
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "ORDER_PAYMENT_STATUS_UPDATED",
            java.util.Map.of(
                "orderId", order.getId(),
                "oldPaymentStatus", previousPaymentStatus,
                "newPaymentStatus", nextPaymentStatus
            )
        );
        return getOrderDetail(orderId);
    }

    private void authorizeOrderAccess(Order order) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.INDIVIDUAL && order.getUser().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE && order.getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private void authorizeOrderManagement(Order order) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE
            && order.getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private Page<Order> listIndividualOrders(UUID userId, Pageable pageable, String status, UUID storeId) {
        if (storeId != null) {
            return status == null
                ? orderRepository.findByUserIdAndStoreIdOrderByOrderDateDesc(userId, storeId, pageable)
                : orderRepository.findByUserIdAndStoreIdAndStatusOrderByOrderDateDesc(userId, storeId, status, pageable);
        }
        return status == null
            ? orderRepository.findByUserIdOrderByOrderDateDesc(userId, pageable)
            : orderRepository.findByUserIdAndStatusOrderByOrderDateDesc(userId, status, pageable);
    }

    private Page<Order> listCorporateOrders(UUID ownerId, Pageable pageable, String status, UUID storeId) {
        if (storeId != null) {
            return status == null
                ? orderRepository.findByStoreOwnerIdAndStoreIdOrderByOrderDateDesc(ownerId, storeId, pageable)
                : orderRepository.findByStoreOwnerIdAndStoreIdAndStatusOrderByOrderDateDesc(ownerId, storeId, status, pageable);
        }
        return status == null
            ? orderRepository.findByStoreOwnerIdOrderByOrderDateDesc(ownerId, pageable)
            : orderRepository.findByStoreOwnerIdAndStatusOrderByOrderDateDesc(ownerId, status, pageable);
    }

    private Page<Order> listAdminOrders(Pageable pageable, String status, UUID storeId) {
        if (storeId != null) {
            return status == null
                ? orderRepository.findByStoreIdOrderByOrderDateDesc(storeId, pageable)
                : orderRepository.findByStoreIdAndStatusOrderByOrderDateDesc(storeId, status, pageable);
        }
        return status == null
            ? orderRepository.findAll(pageable)
            : orderRepository.findByStatusOrderByOrderDateDesc(status, pageable);
    }

    private void validateCheckoutItem(Product product, int quantity) {
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains inactive product");
        }
        if (!"OPEN".equals(product.getStore().getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains item from a closed store");
        }
        if (quantity > product.getStockQuantity()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains quantity above available stock");
        }
    }

    private void reserveStock(Product product, int quantity) {
        int updatedRows = productRepository.decrementStockIfAvailable(product.getId(), quantity);
        if (updatedRows != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cart contains quantity above available stock");
        }
    }

    private BigDecimal lineSubtotal(CartItem cartItem) {
        return money(cartItem.getProduct().getUnitPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity())));
    }

    private BigDecimal calculateDiscount(BigDecimal subtotal, BigDecimal discountPercentage) {
        if (discountPercentage == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return ZERO_MONEY;
        }
        BigDecimal discount = subtotal.multiply(discountPercentage)
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        if (discount.compareTo(subtotal) > 0) {
            return subtotal;
        }
        return money(discount);
    }

    private String resolveStoreCurrency(List<CartItem> storeItems) {
        String currency = normalizeCurrency(storeItems.getFirst().getProduct().getCurrency());
        for (CartItem cartItem : storeItems) {
            String itemCurrency = normalizeCurrency(cartItem.getProduct().getCurrency());
            if (!currency.equals(itemCurrency)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains mixed currencies for the same store");
            }
        }
        return currency;
    }

    private String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains product without currency");
        }
        return currency.trim().toUpperCase();
    }

    private Map<UUID, BigDecimal> distributeOrderDiscount(List<CartItem> storeItems, BigDecimal totalDiscountAmount) {
        Map<UUID, BigDecimal> discountByProductId = new LinkedHashMap<>();
        if (totalDiscountAmount == null || totalDiscountAmount.compareTo(BigDecimal.ZERO) <= 0) {
            for (CartItem item : storeItems) {
                discountByProductId.put(item.getProduct().getId(), ZERO_MONEY);
            }
            return discountByProductId;
        }

        BigDecimal subtotal = storeItems.stream()
            .map(this::lineSubtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal allocated = BigDecimal.ZERO;

        for (int index = 0; index < storeItems.size(); index++) {
            CartItem item = storeItems.get(index);
            BigDecimal itemDiscount;
            if (index == storeItems.size() - 1) {
                itemDiscount = money(totalDiscountAmount.subtract(allocated));
            } else {
                itemDiscount = money(lineSubtotal(item)
                    .multiply(totalDiscountAmount)
                    .divide(subtotal, 2, RoundingMode.HALF_UP));
                allocated = allocated.add(itemDiscount);
            }
            discountByProductId.put(item.getProduct().getId(), itemDiscount.max(BigDecimal.ZERO));
        }
        return discountByProductId;
    }

    private String normalizeReturnStatus(String status) {
        return status.trim().toUpperCase();
    }

    private BigDecimal calculateRefundAmount(OrderItem orderItem) {
        BigDecimal grossLineAmount = money(orderItem.getUnitPriceAtPurchase().multiply(BigDecimal.valueOf(orderItem.getQuantity())));
        BigDecimal lineNetPaid = money(grossLineAmount.subtract(
            orderItem.getDiscountApplied() == null ? ZERO_MONEY : orderItem.getDiscountApplied()
        ).max(BigDecimal.ZERO));
        BigDecimal refundablePerUnit = lineNetPaid.divide(
            BigDecimal.valueOf(orderItem.getQuantity()),
            2,
            RoundingMode.HALF_UP
        );
        return money(refundablePerUnit.multiply(BigDecimal.valueOf(orderItem.getReturnedQuantity() == null ? 0 : orderItem.getReturnedQuantity())));
    }

    private Pageable buildPageable(Integer page, Integer size, String sortExpression) {
        int resolvedPage = page == null ? DEFAULT_PAGE : Math.max(page, 0);
        int resolvedSize = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        String requestedSort = sortExpression == null || sortExpression.isBlank() ? "orderDate,desc" : sortExpression;
        String[] parts = requestedSort.split(",", 2);
        String property = switch (parts[0].trim()) {
            case "grandTotal" -> "grandTotal";
            case "subtotal" -> "subtotal";
            case "status" -> "status";
            default -> "orderDate";
        };
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.ASC
            : Sort.Direction.DESC;
        return PageRequest.of(resolvedPage, resolvedSize, Sort.by(direction, property));
    }

    private String normalizeStatus(String status) {
        return status.trim().toUpperCase();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String generateIncrementId() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "ORD-" + timestamp + "-" + suffix;
    }

    private OrderSummaryResponse toSummaryResponse(Order order) {
        return new OrderSummaryResponse(
            order.getId(),
            order.getIncrementId(),
            order.getCustomerEmail(),
            order.getStore().getId(),
            order.getStore().getName(),
            order.getStatus(),
            order.getPaymentStatus(),
            money(order.getSubtotal()),
            money(order.getDiscountAmount() == null ? ZERO_MONEY : order.getDiscountAmount()),
            money(order.getGrandTotal()),
            order.getCurrency(),
            order.getCouponCode(),
            order.getOrderDate()
        );
    }

    private OrderItemResponse toOrderItemResponse(OrderItem orderItem) {
        return new OrderItemResponse(
            orderItem.getId(),
            orderItem.getProduct().getId(),
            orderItem.getProduct().getSku(),
            orderItem.getProduct().getTitle(),
            orderItem.getQuantity(),
            money(orderItem.getUnitPriceAtPurchase()),
            money(orderItem.getDiscountApplied() == null ? ZERO_MONEY : orderItem.getDiscountApplied()),
            money(orderItem.getSubtotal()),
            orderItem.getReturnStatus(),
            orderItem.getReturnReason(),
            orderItem.getReturnUpdateNote(),
            orderItem.getReturnedQuantity(),
            calculateRefundAmount(orderItem)
        );
    }
}
