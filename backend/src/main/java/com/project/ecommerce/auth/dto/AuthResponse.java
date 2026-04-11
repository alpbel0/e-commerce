package com.project.ecommerce.auth.dto;

import com.project.ecommerce.auth.domain.RoleType;
import java.util.UUID;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresInSeconds,
    UserProfileResponse user
) {

    public record UserProfileResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        RoleType activeRole
    ) {
    }
}
