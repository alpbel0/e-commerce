package com.project.ecommerce.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record UpdateProductRequest(
    @NotNull(message = "categoryId is required")
    UUID categoryId,
    @NotBlank(message = "title is required")
    String title,
    String description,
    String brand,
    List<String> imageUrls,
    @NotNull(message = "unitPrice is required")
    @DecimalMin(value = "0.00", message = "unitPrice must be non-negative")
    BigDecimal unitPrice,
    @DecimalMin(value = "0.00", message = "discountPercentage must be non-negative")
    BigDecimal discountPercentage,
    @DecimalMin(value = "0.00", message = "costOfProduct must be non-negative")
    BigDecimal costOfProduct,
    @Min(value = 0, message = "stockQuantity must be non-negative")
    int stockQuantity,
    List<String> tags,
    Boolean active
) {
}
