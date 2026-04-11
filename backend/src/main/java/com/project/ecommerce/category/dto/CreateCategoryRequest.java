package com.project.ecommerce.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateCategoryRequest(
    @NotBlank String name,
    String description,
    Integer displayOrder,
    UUID parentId,
    @NotNull Boolean active
) {
}
