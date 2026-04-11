package com.project.ecommerce.notification.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationResponse(
    UUID id,
    String type,
    String title,
    String message,
    boolean read,
    LocalDateTime readAt,
    LocalDateTime createdAt,
    UUID orderId,
    String orderIncrementId
) {
}
