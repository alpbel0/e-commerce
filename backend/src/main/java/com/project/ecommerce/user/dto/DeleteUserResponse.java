package com.project.ecommerce.user.dto;

import java.util.UUID;

public record DeleteUserResponse(
    UUID userId,
    boolean active,
    String message
) {
}
