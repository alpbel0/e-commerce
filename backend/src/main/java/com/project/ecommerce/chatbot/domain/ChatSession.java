package com.project.ecommerce.chatbot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_sessions")
public class ChatSession {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;

    public static ChatSession create(UUID id, UUID userId) {
        ChatSession session = new ChatSession();
        Instant now = Instant.now();
        session.id = id;
        session.userId = userId;
        session.createdAt = now;
        session.updatedAt = now;
        session.lastMessageAt = now;
        return session;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public void touch() {
        Instant now = Instant.now();
        this.updatedAt = now;
        this.lastMessageAt = now;
    }
}
