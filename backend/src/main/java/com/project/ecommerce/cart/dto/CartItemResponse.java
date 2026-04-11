package com.project.ecommerce.cart.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CartItemResponse(
    UUID itemId,
    UUID productId,
    String sku,
    String title,
    int quantity,
    BigDecimal unitPrice,
    BigDecimal lineSubtotal,
    UUID categoryId,
    String categoryName
) {
}
