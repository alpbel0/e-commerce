package com.project.ecommerce.cart.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record StoreCartResponse(
    UUID storeId,
    String storeName,
    int totalItemCount,
    BigDecimal subtotal,
    BigDecimal discountApplied,
    BigDecimal grandTotal,
    CartCouponResponse activeCoupon,
    List<CartItemResponse> items
) {
}
