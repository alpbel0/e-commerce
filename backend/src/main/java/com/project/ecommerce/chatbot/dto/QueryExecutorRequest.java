package com.project.ecommerce.chatbot.dto;

import com.project.ecommerce.auth.domain.RoleType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record QueryExecutorRequest(
    @NotNull
    UUID requestId,

    @NotBlank
    String sql,

    @Valid
    @NotNull
    QueryParameters parameters,

    @Valid
    @NotNull
    UserContext userContext,

    String executionPolicy
) {
}
