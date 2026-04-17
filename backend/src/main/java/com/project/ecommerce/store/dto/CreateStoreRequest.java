package com.project.ecommerce.store.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStoreRequest(
    @NotBlank @Size(max = 255) String name,
    String description,
    @Size(max = 255) String contactEmail,
    @Size(max = 20) String contactPhone,
    String address
) {
}
