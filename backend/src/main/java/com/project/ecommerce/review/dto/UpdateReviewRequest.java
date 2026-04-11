package com.project.ecommerce.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record UpdateReviewRequest(
    @Min(1) @Max(5) int starRating,
    @NotBlank String reviewTitle,
    @NotBlank String reviewText,
    List<String> reviewImages
) {
}
