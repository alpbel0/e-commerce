package com.project.ecommerce.auth.dto;

import com.project.ecommerce.auth.domain.RoleType;
import java.util.UUID;

public record AdminUserSummaryResponse(
    UUID id,
    String email,
    String firstName,
    String lastName,
    RoleType activeRole,
    boolean active
) {
}
