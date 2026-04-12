package com.project.ecommerce.user.dto;

import com.project.ecommerce.auth.domain.RoleType;
import java.util.UUID;

public record AdminUserListResponse(
    UUID id,
    String email,
    String firstName,
    String lastName,
    RoleType activeRole,
    boolean active
) {}
