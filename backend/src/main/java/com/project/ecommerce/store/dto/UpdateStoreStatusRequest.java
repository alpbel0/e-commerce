package com.project.ecommerce.store.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateStoreStatusRequest(
    @NotBlank(message = "status must not be blank") String status
) {
}
