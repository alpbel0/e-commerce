package com.project.ecommerce.cart.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CartResponse(
    UUID cartId,
    int totalItemCount,
    BigDecimal subtotal,
    BigDecimal discountApplied,
    BigDecimal grandTotal,
    List<StoreCartResponse> stores,
    LocalDateTime updatedAt
) {
}
