package com.project.ecommerce.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record CreateReviewRequest(
    @NotNull UUID orderId,
    @NotNull UUID productId,
    @Min(1) @Max(5) int starRating,
    @NotBlank String reviewTitle,
    @NotBlank String reviewText,
    List<String> reviewImages
) {
}
