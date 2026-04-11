package com.project.ecommerce.cart.web;

import com.project.ecommerce.cart.dto.AddCartItemRequest;
import com.project.ecommerce.cart.dto.ApplyStoreCouponRequest;
import com.project.ecommerce.cart.dto.CartResponse;
import com.project.ecommerce.cart.dto.UpdateCartItemRequest;
import com.project.ecommerce.cart.service.CartService;
import com.project.ecommerce.common.api.ApiListResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/carts/me")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public CartResponse getMyCart() {
        return cartService.getMyCart();
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public CartResponse addItem(@Valid @RequestBody AddCartItemRequest request) {
        return cartService.addItem(request);
    }

    @PatchMapping("/items/{itemId}")
    public CartResponse updateItem(@PathVariable UUID itemId, @Valid @RequestBody UpdateCartItemRequest request) {
        return cartService.updateItem(itemId, request);
    }

    @DeleteMapping("/items/{itemId}")
    public CartResponse removeItem(@PathVariable UUID itemId) {
        return cartService.removeItem(itemId);
    }

    @GetMapping("/stores/{storeId}/coupons")
    public ApiListResponse<String> listStoreCoupons(@PathVariable UUID storeId) {
        return cartService.listAvailableCoupons(storeId);
    }

    @PostMapping("/stores/{storeId}/coupon")
    public CartResponse applyCoupon(@PathVariable UUID storeId, @Valid @RequestBody ApplyStoreCouponRequest request) {
        return cartService.applyStoreCoupon(storeId, request);
    }

    @DeleteMapping("/stores/{storeId}/coupon")
    public CartResponse removeCoupon(@PathVariable UUID storeId) {
        return cartService.removeStoreCoupon(storeId);
    }
}
