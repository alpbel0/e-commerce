package com.project.ecommerce.category.dto;

public record UpdateCategoryRequest(
    String name,
    String description,
    Integer displayOrder,
    Boolean active
) {
}
