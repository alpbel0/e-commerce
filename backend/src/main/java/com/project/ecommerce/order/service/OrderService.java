package com.project.ecommerce.order.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
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
import com.project.ecommerce.order.dto.UpdateOrderStatusRequest;
import com.project.ecommerce.order.dto.UpdatePaymentStatusRequest;
import com.project.ecommerce.order.repository.OrderItemRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.notification.service.NotificationService;
import com.project.ecommerce.product.domain.Product;
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

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ShipmentRepository shipmentRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final CartStoreCouponRepository cartStoreCouponRepository;
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
            order.setCurrency("TRY");
            order.setCouponCode(storeCoupon == null ? null : storeCoupon.getCoupon().getCode());
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

            for (CartItem cartItem : storeItems) {
                Product product = cartItem.getProduct();

                OrderItem orderItem = new OrderItem();
                orderItem.setId(UUID.randomUUID());
                orderItem.setOrder(order);
                orderItem.setProduct(product);
                orderItem.setQuantity(cartItem.getQuantity());
                orderItem.setUnitPriceAtPurchase(money(product.getUnitPrice()));
                orderItem.setDiscountApplied(ZERO_MONEY);
                orderItem.setSubtotal(lineSubtotal(cartItem));
                orderItem.setReturnStatus("NONE");
                orderItem.setReturnedQuantity(0);
                orderItemRepository.save(orderItem);

                product.setStockQuantity(product.getStockQuantity() - cartItem.getQuantity());
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
    public ApiPageResponse<OrderSummaryResponse> listOrders(Integer page, Integer size, String sort, String status) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        Pageable pageable = buildPageable(page, size, sort);
        Page<Order> resultPage = switch (authenticatedUser.getActiveRole()) {
            case INDIVIDUAL -> status == null || status.isBlank()
                ? orderRepository.findByUserIdOrderByOrderDateDesc(authenticatedUser.getUserId(), pageable)
                : orderRepository.findByUserIdAndStatusOrderByOrderDateDesc(authenticatedUser.getUserId(), normalizeStatus(status), pageable);
            case CORPORATE -> status == null || status.isBlank()
                ? orderRepository.findByStoreOwnerIdOrderByOrderDateDesc(authenticatedUser.getUserId(), pageable)
                : orderRepository.findByStoreOwnerIdAndStatusOrderByOrderDateDesc(authenticatedUser.getUserId(), normalizeStatus(status), pageable);
            case ADMIN -> status == null || status.isBlank()
                ? orderRepository.findAll(pageable)
                : orderRepository.findByStatusOrderByOrderDateDesc(normalizeStatus(status), pageable);
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
            .map(orderItem -> new OrderItemResponse(
                orderItem.getId(),
                orderItem.getProduct().getId(),
                orderItem.getProduct().getSku(),
                orderItem.getProduct().getTitle(),
                orderItem.getQuantity(),
                money(orderItem.getUnitPriceAtPurchase()),
                money(orderItem.getDiscountApplied() == null ? ZERO_MONEY : orderItem.getDiscountApplied()),
                money(orderItem.getSubtotal())
            ))
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

    private void validateCheckoutItem(Product product, int quantity) {
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains inactive product");
        }
        if (quantity > product.getStockQuantity()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains quantity above available stock");
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
            order.getStore().getId(),
            order.getStore().getName(),
            order.getStatus(),
            order.getPaymentStatus(),
            money(order.getSubtotal()),
            money(order.getDiscountAmount() == null ? ZERO_MONEY : order.getDiscountAmount()),
            money(order.getGrandTotal()),
            order.getCouponCode(),
            order.getOrderDate()
        );
    }
}
