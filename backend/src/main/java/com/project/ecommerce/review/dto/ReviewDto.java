package com.project.ecommerce.review.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ReviewDto(
    UUID id,
    UUID userId,
    String userEmail,
    UUID productId,
    UUID orderId,
    int starRating,
    String reviewTitle,
    String reviewText,
    List<String> reviewImages,
    boolean verifiedPurchase,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<ReviewResponseDto> responses
) {
}
