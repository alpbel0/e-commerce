package com.project.ecommerce.product.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record AddProductImagesRequest(
    @NotEmpty List<String> imageUrls
) {
}
