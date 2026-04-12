package com.project.ecommerce.user.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(
    @NotNull(message = "active status is required")
    Boolean active
) {}
