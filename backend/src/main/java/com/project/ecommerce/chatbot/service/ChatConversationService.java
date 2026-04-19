package com.project.ecommerce.chatbot.service;

import com.project.ecommerce.chatbot.domain.ChatMessage;
import com.project.ecommerce.chatbot.domain.ChatSession;
import com.project.ecommerce.chatbot.dto.ChatAskResponse;
import com.project.ecommerce.chatbot.dto.ChatSessionStateResponse;
import com.project.ecommerce.chatbot.dto.ConversationMessage;
import com.project.ecommerce.chatbot.repository.ChatMessageRepository;
import com.project.ecommerce.chatbot.repository.ChatSessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@Service
public class ChatConversationService {

    private static final int AI_HISTORY_LIMIT = 8;
    private static final int UI_HISTORY_LIMIT = 50;

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ObjectMapper objectMapper;

    public ChatConversationService(
        ChatSessionRepository chatSessionRepository,
        ChatMessageRepository chatMessageRepository,
        ObjectMapper objectMapper
    ) {
        this.chatSessionRepository = chatSessionRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ChatSession ensureSession(UUID userId, UUID requestedSessionId) {
        if (requestedSessionId == null) {
            return chatSessionRepository
                .findFirstByUserIdOrderByLastMessageAtDesc(userId)
                .orElseGet(() -> chatSessionRepository.save(ChatSession.create(UUID.randomUUID(), userId)));
        }

        return chatSessionRepository.findById(requestedSessionId)
            .map(session -> {
                if (!session.getUserId().equals(userId)) {
                    throw new ResponseStatusException(FORBIDDEN, "Chat session does not belong to the current user");
                }
                return session;
            })
            .orElseGet(() -> chatSessionRepository.save(ChatSession.create(requestedSessionId, userId)));
    }

    @Transactional
    public ChatSessionStateResponse getActiveSession(UUID userId) {
        ChatSession session = chatSessionRepository
            .findFirstByUserIdOrderByLastMessageAtDesc(userId)
            .orElseGet(() -> chatSessionRepository.save(ChatSession.create(UUID.randomUUID(), userId)));

        return new ChatSessionStateResponse(
            session.getId(),
            getMessagesForUi(userId, session.getId()),
            session.getLastMessageAt()
        );
    }

    @Transactional
    public ChatSessionStateResponse createNewSession(UUID userId) {
        ChatSession session = chatSessionRepository.save(ChatSession.create(UUID.randomUUID(), userId));
        return new ChatSessionStateResponse(session.getId(), List.of(), session.getLastMessageAt());
    }

    @Transactional
    public void appendUserMessage(UUID userId, UUID sessionId, String content) {
        ChatSession session = requireOwnedSession(userId, sessionId);
        chatMessageRepository.save(ChatMessage.create(sessionId, userId, ChatMessage.SenderRole.user, sanitize(content)));
        session.touch();
        chatSessionRepository.save(session);
    }

    @Transactional
    public void appendAssistantMessage(UUID userId, UUID sessionId, String content, ChatAskResponse response) {
        if (content == null || content.isBlank()) {
            return;
        }
        ChatSession session = requireOwnedSession(userId, sessionId);
        chatMessageRepository.save(
            ChatMessage.create(
                sessionId,
                userId,
                ChatMessage.SenderRole.assistant,
                sanitize(content),
                serializeResponse(response)
            )
        );
        session.touch();
        chatSessionRepository.save(session);
    }

    @Transactional(readOnly = true)
    public List<ConversationMessage> getConversationForAi(UUID userId, UUID sessionId, String currentMessage) {
        requireOwnedSession(userId, sessionId);
        List<ChatMessage> recent = new ArrayList<>(
            chatMessageRepository.findBySessionIdAndUserIdOrderByCreatedAtDesc(
                sessionId,
                userId,
                PageRequest.of(0, AI_HISTORY_LIMIT + 1)
            )
        );
        recent.sort(Comparator.comparing(ChatMessage::getCreatedAt));

        if (!recent.isEmpty()) {
            ChatMessage last = recent.getLast();
            if (last.getSenderRole() == ChatMessage.SenderRole.user
                && Objects.equals(last.getContent(), sanitize(currentMessage))) {
                recent.removeLast();
            }
        }

        if (recent.size() > AI_HISTORY_LIMIT) {
            recent = new ArrayList<>(recent.subList(recent.size() - AI_HISTORY_LIMIT, recent.size()));
        }

        return recent.stream()
            .map(message -> new ConversationMessage(message.getSenderRole().name(), message.getContent(), null))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ConversationMessage> getMessagesForUi(UUID userId, UUID sessionId) {
        requireOwnedSession(userId, sessionId);
        List<ChatMessage> recent = new ArrayList<>(
            chatMessageRepository.findBySessionIdAndUserIdOrderByCreatedAtDesc(
                sessionId,
                userId,
                PageRequest.of(0, UI_HISTORY_LIMIT)
            )
        );
        recent.sort(Comparator.comparing(ChatMessage::getCreatedAt));
        return recent.stream()
            .map(message -> new ConversationMessage(
                message.getSenderRole().name(),
                message.getContent(),
                deserializeResponse(message.getResponseJson())
            ))
            .toList();
    }

    private ChatSession requireOwnedSession(UUID userId, UUID sessionId) {
        return chatSessionRepository.findByIdAndUserId(sessionId, userId)
            .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "Chat session does not belong to the current user"));
    }

    private String sanitize(String content) {
        if (content == null) {
            return "";
        }
        return content.trim();
    }

    private String serializeResponse(ChatAskResponse response) {
        if (response == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private ChatAskResponse deserializeResponse(String responseJson) {
        if (responseJson == null || responseJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(responseJson, ChatAskResponse.class);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }
}
