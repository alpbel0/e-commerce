package com.project.ecommerce.auth.dto;

import com.project.ecommerce.auth.domain.RoleType;
import java.util.UUID;

public record ProfileResponse(
    UUID id,
    String email,
    String firstName,
    String lastName,
    String phone,
    String address,
    String profileImageUrl,
    RoleType activeRole,
    boolean active
) {}
