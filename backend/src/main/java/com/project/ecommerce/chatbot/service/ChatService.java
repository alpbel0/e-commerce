package com.project.ecommerce.chatbot.service;

import com.project.ecommerce.chatbot.config.ChatbotProperties;
import com.project.ecommerce.chatbot.dto.ChatAskRequest;
import com.project.ecommerce.chatbot.dto.ChatAskResponse;
import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final RestTemplate restTemplate;
    private final ChatbotProperties chatbotProperties;

    public ChatService(ChatbotProperties chatbotProperties, RestTemplateBuilder restTemplateBuilder) {
        this.chatbotProperties = chatbotProperties;
        this.restTemplate = restTemplateBuilder.build();
    }

    public ChatAskResponse askQuestion(ChatAskRequest request) {
        String url = chatbotProperties.getAiServiceUrl() + "/chat/ask";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-AI-Service-Key", chatbotProperties.getAiServiceKey());

        HttpEntity<ChatAskRequest> entity = new HttpEntity<>(request, headers);

        log.info("Sending chat request to AI service: sessionId={}, userId={}, role={}",
            request.sessionId(), request.user().userId(), request.user().role());

        try {
            ResponseEntity<ChatAskResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                ChatAskResponse.class
            );

            log.info("Received response from AI service: requestId={}",
                response.getBody() != null ? response.getBody().requestId() : "null");

            return response.getBody();
        } catch (Exception e) {
            log.error("Failed to call AI service: {}", e.getMessage());
            return createErrorResponse(
                request.sessionId(),
                "BACKEND_UNAVAILABLE",
                "AI service is currently unavailable. Please try again later."
            );
        }
    }

    private ChatAskResponse createErrorResponse(UUID sessionId, String code, String message) {
        return new ChatAskResponse(
            UUID.randomUUID(),
            null,
            null,
            null,
            null,
            null,
            null,
            new ChatAskResponse.ErrorResponse(code, message)
        );
    }
}
