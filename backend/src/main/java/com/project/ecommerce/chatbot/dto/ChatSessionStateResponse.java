package com.project.ecommerce.chatbot.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatSessionStateResponse(
    UUID sessionId,
    List<ConversationMessage> messages,
    Instant lastMessageAt
) {
}
