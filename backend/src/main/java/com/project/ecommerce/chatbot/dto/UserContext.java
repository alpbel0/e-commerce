package com.project.ecommerce.chatbot.dto;

import com.project.ecommerce.auth.domain.RoleType;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record UserContext(
    @NotNull
    UUID userId,

    String email,

    @NotNull
    RoleType role
) {
}
