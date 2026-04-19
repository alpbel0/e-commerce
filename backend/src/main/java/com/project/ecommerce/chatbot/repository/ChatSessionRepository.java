package com.project.ecommerce.chatbot.repository;

import com.project.ecommerce.chatbot.domain.ChatSession;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatSessionRepository extends JpaRepository<ChatSession, UUID> {

    Optional<ChatSession> findByIdAndUserId(UUID id, UUID userId);

    Optional<ChatSession> findFirstByUserIdOrderByLastMessageAtDesc(UUID userId);
}
