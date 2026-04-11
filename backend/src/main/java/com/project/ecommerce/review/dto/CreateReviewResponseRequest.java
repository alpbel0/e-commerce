package com.project.ecommerce.review.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateReviewResponseRequest(
    @NotBlank String responseText
) {
}
