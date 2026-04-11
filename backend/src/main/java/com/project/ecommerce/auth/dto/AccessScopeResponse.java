package com.project.ecommerce.auth.dto;

import com.project.ecommerce.auth.domain.RoleType;
import java.util.List;
import java.util.UUID;

public record AccessScopeResponse(
    UUID userId,
    String email,
    RoleType activeRole,
    List<UUID> ownedStoreIds,
    List<String> ownedStoreNames
) {
}
