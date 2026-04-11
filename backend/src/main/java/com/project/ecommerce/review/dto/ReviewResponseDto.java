package com.project.ecommerce.review.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ReviewResponseDto(
    UUID id,
    UUID responderUserId,
    String responderEmail,
    String responseText,
    LocalDateTime createdAt
) {
}
