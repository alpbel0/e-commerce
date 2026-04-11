package com.project.ecommerce.store.dto;

import java.util.UUID;

public record StoreSummaryResponse(
    UUID id,
    String name,
    String contactEmail,
    String status,
    Integer productCount,
    String ownerEmail
) {
}
