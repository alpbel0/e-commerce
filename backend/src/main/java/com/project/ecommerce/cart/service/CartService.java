package com.project.ecommerce.cart.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.cart.domain.Cart;
import com.project.ecommerce.cart.domain.CartItem;
import com.project.ecommerce.cart.domain.CartStoreCoupon;
import com.project.ecommerce.cart.dto.AddCartItemRequest;
import com.project.ecommerce.cart.dto.ApplyStoreCouponRequest;
import com.project.ecommerce.cart.dto.CartCouponResponse;
import com.project.ecommerce.cart.dto.CartItemResponse;
import com.project.ecommerce.cart.dto.CartResponse;
import com.project.ecommerce.cart.dto.StoreCartResponse;
import com.project.ecommerce.cart.dto.UpdateCartItemRequest;
import com.project.ecommerce.cart.repository.CartItemRepository;
import com.project.ecommerce.cart.repository.CartRepository;
import com.project.ecommerce.cart.repository.CartStoreCouponRepository;
import com.project.ecommerce.common.api.ApiListResponse;
import com.project.ecommerce.coupon.repository.CouponRepository;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final CartStoreCouponRepository cartStoreCouponRepository;
    private final ProductRepository productRepository;
    private final CouponRepository couponRepository;
    private final CurrentUserService currentUserService;

    public CartService(
        CartRepository cartRepository,
        CartItemRepository cartItemRepository,
        CartStoreCouponRepository cartStoreCouponRepository,
        ProductRepository productRepository,
        CouponRepository couponRepository,
        CurrentUserService currentUserService
    ) {
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.cartStoreCouponRepository = cartStoreCouponRepository;
        this.productRepository = productRepository;
        this.couponRepository = couponRepository;
        this.currentUserService = currentUserService;
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CartResponse getMyCart() {
        Cart cart = getOrCreateCurrentUserCart();
        return buildCartResponse(cart);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CartResponse addItem(AddCartItemRequest request) {
        Cart cart = getOrCreateCurrentUserCart();
        Product product = productRepository.findByIdAndActiveTrue(request.productId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        validateStoreIsOpen(product);
        validateStock(product, request.quantity());

        CartItem cartItem = cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId())
            .orElseGet(() -> {
                CartItem newItem = new CartItem();
                newItem.setId(UUID.randomUUID());
                newItem.setCart(cart);
                newItem.setProduct(product);
                newItem.setQuantity(0);
                return newItem;
            });

        int newQuantity = cartItem.getQuantity() + request.quantity();
        validateStock(product, newQuantity);
        cartItem.setQuantity(newQuantity);
        cartItemRepository.save(cartItem);
        return buildCartResponse(cart);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CartResponse updateItem(UUID itemId, UpdateCartItemRequest request) {
        Cart cart = getOrCreateCurrentUserCart();
        CartItem cartItem = cartItemRepository.findById(itemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart item not found"));
        assertItemBelongsToCart(cart, cartItem);

        if (request.quantity() == 0) {
            UUID storeId = cartItem.getProduct().getStore().getId();
            cartItemRepository.delete(cartItem);
            cleanupStoreCouponIfStoreIsEmpty(cart, storeId);
            return buildCartResponse(cart);
        }

        validateActiveProduct(cartItem.getProduct());
        validateStoreIsOpen(cartItem.getProduct());
        validateStock(cartItem.getProduct(), request.quantity());
        cartItem.setQuantity(request.quantity());
        cartItemRepository.save(cartItem);
        return buildCartResponse(cart);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CartResponse removeItem(UUID itemId) {
        Cart cart = getOrCreateCurrentUserCart();
        CartItem cartItem = cartItemRepository.findById(itemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart item not found"));
        assertItemBelongsToCart(cart, cartItem);
        UUID storeId = cartItem.getProduct().getStore().getId();
        cartItemRepository.delete(cartItem);
        cleanupStoreCouponIfStoreIsEmpty(cart, storeId);
        return buildCartResponse(cart);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CartResponse applyStoreCoupon(UUID storeId, ApplyStoreCouponRequest request) {
        Cart cart = getOrCreateCurrentUserCart();
        if (!cartItemRepository.existsByCartIdAndProductStoreId(cart.getId(), storeId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart does not contain items for the selected store");
        }

        var coupon = couponRepository.findByStoreIdAndCodeIgnoreCaseAndActiveTrue(storeId, request.code().trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon not found"));

        if (coupon.getValidUntil() != null && coupon.getValidUntil().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coupon is expired");
        }

        CartStoreCoupon mapping = cartStoreCouponRepository.findByCartIdAndStoreId(cart.getId(), storeId)
            .orElseGet(() -> {
                CartStoreCoupon newMapping = new CartStoreCoupon();
                newMapping.setId(UUID.randomUUID());
                newMapping.setCart(cart);
                newMapping.setStore(coupon.getStore());
                return newMapping;
            });
        mapping.setCoupon(coupon);
        mapping.setStore(coupon.getStore());
        cartStoreCouponRepository.save(mapping);
        return buildCartResponse(cart);
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public CartResponse removeStoreCoupon(UUID storeId) {
        Cart cart = getOrCreateCurrentUserCart();
        cartStoreCouponRepository.deleteByCartIdAndStoreId(cart.getId(), storeId);
        return buildCartResponse(cart);
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    public ApiListResponse<String> listAvailableCoupons(UUID storeId) {
        var coupons = couponRepository.findByStoreId(storeId).stream()
            .filter(coupon -> coupon.isActive() && (coupon.getValidUntil() == null || !coupon.getValidUntil().isBefore(LocalDateTime.now())))
            .map(coupon -> coupon.getCode())
            .sorted()
            .toList();
        return new ApiListResponse<>(coupons, coupons.size());
    }

    private CartResponse buildCartResponse(Cart cart) {
        List<CartItem> cartItems = cartItemRepository.findByCartId(cart.getId());
        List<CartStoreCoupon> cartCoupons = cartStoreCouponRepository.findByCartId(cart.getId());

        Map<UUID, CartStoreCoupon> couponByStoreId = new LinkedHashMap<>();
        for (CartStoreCoupon cartCoupon : cartCoupons) {
            couponByStoreId.put(cartCoupon.getStore().getId(), cartCoupon);
        }

        Map<UUID, List<CartItem>> itemsByStoreId = new LinkedHashMap<>();
        for (CartItem cartItem : cartItems) {
            UUID storeId = cartItem.getProduct().getStore().getId();
            itemsByStoreId.computeIfAbsent(storeId, ignored -> new ArrayList<>()).add(cartItem);
        }

        BigDecimal totalSubtotal = money(BigDecimal.ZERO);
        BigDecimal totalDiscount = money(BigDecimal.ZERO);
        BigDecimal totalGrandTotal = money(BigDecimal.ZERO);
        int totalItemCount = 0;
        List<StoreCartResponse> stores = new ArrayList<>();

        var sortedStoreEntries = itemsByStoreId.entrySet().stream()
            .sorted(Comparator.comparing(entry -> entry.getValue().getFirst().getProduct().getStore().getName()))
            .toList();

        for (var entry : sortedStoreEntries) {
            List<CartItem> storeItems = entry.getValue();
            var firstStore = storeItems.getFirst().getProduct().getStore();
            List<CartItemResponse> itemResponses = storeItems.stream()
                .map(this::toCartItemResponse)
                .toList();

            int storeItemCount = storeItems.stream().mapToInt(CartItem::getQuantity).sum();
            BigDecimal storeSubtotal = storeItems.stream()
                .map(this::lineSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            storeSubtotal = money(storeSubtotal);

            CartStoreCoupon appliedCoupon = couponByStoreId.get(entry.getKey());
            BigDecimal storeDiscount = appliedCoupon == null
                ? money(BigDecimal.ZERO)
                : calculateDiscount(storeSubtotal, appliedCoupon.getCoupon().getDiscountPercentage());
            BigDecimal storeGrandTotal = money(storeSubtotal.subtract(storeDiscount).max(BigDecimal.ZERO));

            stores.add(new StoreCartResponse(
                firstStore.getId(),
                firstStore.getName(),
                storeItemCount,
                storeSubtotal,
                storeDiscount,
                storeGrandTotal,
                appliedCoupon == null ? null : new CartCouponResponse(
                    appliedCoupon.getCoupon().getId(),
                    appliedCoupon.getCoupon().getCode(),
                    appliedCoupon.getCoupon().getDiscountPercentage()
                ),
                itemResponses
            ));

            totalSubtotal = totalSubtotal.add(storeSubtotal);
            totalDiscount = totalDiscount.add(storeDiscount);
            totalGrandTotal = totalGrandTotal.add(storeGrandTotal);
            totalItemCount += storeItemCount;
        }

        return new CartResponse(
            cart.getId(),
            totalItemCount,
            money(totalSubtotal),
            money(totalDiscount),
            money(totalGrandTotal),
            stores,
            cart.getUpdatedAt()
        );
    }

    private CartItemResponse toCartItemResponse(CartItem cartItem) {
        Product product = cartItem.getProduct();
        return new CartItemResponse(
            cartItem.getId(),
            product.getId(),
            product.getSku(),
            product.getTitle(),
            cartItem.getQuantity(),
            money(product.getUnitPrice()),
            lineSubtotal(cartItem),
            product.getCategory().getId(),
            product.getCategory().getName()
        );
    }

    private BigDecimal lineSubtotal(CartItem cartItem) {
        return money(cartItem.getProduct().getUnitPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity())));
    }

    private BigDecimal calculateDiscount(BigDecimal subtotal, BigDecimal discountPercentage) {
        if (discountPercentage == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return money(BigDecimal.ZERO);
        }
        BigDecimal discount = subtotal.multiply(discountPercentage)
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        if (discount.compareTo(subtotal) > 0) {
            return subtotal;
        }
        return money(discount);
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private Cart getOrCreateCurrentUserCart() {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.INDIVIDUAL) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cart is available only for individual users");
        }

        return cartRepository.findByUserId(authenticatedUser.getUserId())
            .orElseGet(() -> {
                Cart cart = new Cart();
                cart.setId(UUID.randomUUID());
                cart.setUser(currentUserService.requireCurrentAppUser());
                return cartRepository.save(cart);
            });
    }

    private void assertItemBelongsToCart(Cart cart, CartItem cartItem) {
        if (!cartItem.getCart().getId().equals(cart.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cart item does not belong to current user");
        }
    }

    private void validateStock(Product product, int quantity) {
        if (quantity > product.getStockQuantity()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested quantity exceeds available stock");
        }
    }

    private void validateStoreIsOpen(Product product) {
        if (!"OPEN".equals(product.getStore().getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This store is closed, so you cannot buy from it");
        }
    }

    private void validateActiveProduct(Product product) {
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inactive product cannot be added to cart");
        }
    }

    private void cleanupStoreCouponIfStoreIsEmpty(Cart cart, UUID storeId) {
        if (!cartItemRepository.existsByCartIdAndProductStoreId(cart.getId(), storeId)) {
            cartStoreCouponRepository.deleteByCartIdAndStoreId(cart.getId(), storeId);
        }
    }
}
