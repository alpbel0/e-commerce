package com.project.ecommerce.category.dto;

import java.util.UUID;

public record CategoryResponse(
    UUID id,
    String name,
    String slug,
    String description,
    UUID parentId,
    int level,
    boolean active,
    int displayOrder
) {
}
