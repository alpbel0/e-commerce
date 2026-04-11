package com.project.ecommerce.store.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record StoreDetailResponse(
    UUID id,
    String name,
    String description,
    String contactEmail,
    String contactPhone,
    String address,
    BigDecimal totalSales,
    Integer productCount,
    BigDecimal rating,
    String status,
    UUID ownerId,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
