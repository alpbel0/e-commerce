package com.project.ecommerce.auditlog.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    UUID userId,
    UUID actorUserId,
    String actorUserEmail,
    String action,
    String entityType,
    String entityId,
    String details,
    LocalDateTime createdAt
) {
}
