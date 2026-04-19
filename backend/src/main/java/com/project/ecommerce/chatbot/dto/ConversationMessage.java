package com.project.ecommerce.chatbot.dto;

public record ConversationMessage(
    String role,
    String content,
    ChatAskResponse response
) {
}
