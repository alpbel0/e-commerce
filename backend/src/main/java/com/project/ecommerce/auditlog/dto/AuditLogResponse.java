package com.project.ecommerce.auditlog.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    UUID actorUserId,
    String actorUserEmail,
    String action,
    String details,
    LocalDateTime createdAt
) {
}
