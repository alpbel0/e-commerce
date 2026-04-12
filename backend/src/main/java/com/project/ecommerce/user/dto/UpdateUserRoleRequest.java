package com.project.ecommerce.user.dto;

import com.project.ecommerce.auth.domain.RoleType;
import jakarta.validation.constraints.NotNull;

public record UpdateUserRoleRequest(
    @NotNull(message = "role is required")
    RoleType role
) {}
