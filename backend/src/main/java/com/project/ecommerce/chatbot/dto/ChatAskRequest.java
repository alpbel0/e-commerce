package com.project.ecommerce.chatbot.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ChatAskRequest(
    UUID sessionId,
    String message,
    LocalDate currentDate,
    UserContext user,
    AccessScope accessScope,
    List<ConversationMessage> conversation
) {
}
