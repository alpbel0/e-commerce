package com.project.ecommerce.chatbot.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record QueryParameters(
    @NotNull
    UUID currentUserId,

    List<UUID> allowedStoreIds,

    UUID selectedStoreId,

    LocalDate startDate,

    LocalDate endDate,

    @Min(0)
    int limit
) {
}
