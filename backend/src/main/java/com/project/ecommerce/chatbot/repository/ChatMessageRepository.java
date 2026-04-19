package com.project.ecommerce.chatbot.repository;

import com.project.ecommerce.chatbot.domain.ChatMessage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    List<ChatMessage> findBySessionIdAndUserIdOrderByCreatedAtAsc(UUID sessionId, UUID userId);

    List<ChatMessage> findBySessionIdAndUserIdOrderByCreatedAtDesc(UUID sessionId, UUID userId, Pageable pageable);
}
