package com.project.ecommerce.chatbot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    public enum SenderRole {
        user,
        assistant
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_role", nullable = false, length = 20)
    private SenderRole senderRole;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "response_json", columnDefinition = "TEXT")
    private String responseJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static ChatMessage create(UUID sessionId, UUID userId, SenderRole senderRole, String content) {
        return create(sessionId, userId, senderRole, content, null);
    }

    public static ChatMessage create(
        UUID sessionId,
        UUID userId,
        SenderRole senderRole,
        String content,
        String responseJson
    ) {
        ChatMessage message = new ChatMessage();
        message.sessionId = sessionId;
        message.userId = userId;
        message.senderRole = senderRole;
        message.content = content;
        message.responseJson = responseJson;
        message.createdAt = Instant.now();
        return message;
    }

    public UUID getId() {
        return id;
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public UUID getUserId() {
        return userId;
    }

    public SenderRole getSenderRole() {
        return senderRole;
    }

    public String getContent() {
        return content;
    }

    public String getResponseJson() {
        return responseJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
