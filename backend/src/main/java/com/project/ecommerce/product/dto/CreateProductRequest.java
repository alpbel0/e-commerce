package com.project.ecommerce.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateProductRequest(
    @NotNull UUID storeId,
    @NotNull UUID categoryId,
    @NotBlank String sku,
    @NotBlank String title,
    String description,
    String brand,
    List<String> imageUrls,
    @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
    @DecimalMin("0.00") BigDecimal discountPercentage,
    @DecimalMin("0.00") BigDecimal costOfProduct,
    @PositiveOrZero int stockQuantity,
    List<String> tags
) {
}
