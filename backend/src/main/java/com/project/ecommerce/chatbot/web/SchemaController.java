package com.project.ecommerce.chatbot.web;

import com.project.ecommerce.chatbot.config.ChatbotProperties;
import com.project.ecommerce.chatbot.dto.SchemaResponse;
import com.project.ecommerce.chatbot.service.SchemaService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal endpoint for AI service to fetch analytics schema.
 * Protected by shared secret (X-AI-Service-Key header).
 */
@RestController
@RequestMapping("/internal/schema")
public class SchemaController {

    private static final Logger log = LoggerFactory.getLogger(SchemaController.class);

    private final SchemaService schemaService;
    private final ChatbotProperties chatbotProperties;

    public SchemaController(SchemaService schemaService, ChatbotProperties chatbotProperties) {
        this.schemaService = schemaService;
        this.chatbotProperties = chatbotProperties;
    }

    @GetMapping
    public ResponseEntity<SchemaResponse> getSchema(HttpServletRequest httpRequest) {
        // Validate X-AI-Service-Key header (shared secret)
        String providedKey = httpRequest.getHeader("X-AI-Service-Key");

        if (providedKey == null || providedKey.isBlank()) {
            log.warn("Schema endpoint called without X-AI-Service-Key header");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .build();
        }

        if (!providedKey.equals(chatbotProperties.getAiServiceKey())) {
            log.warn("Schema endpoint called with invalid X-AI-Service-Key");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .build();
        }

        log.info("Schema endpoint called successfully");
        SchemaResponse response = schemaService.getAnalyticsSchema();

        return ResponseEntity.ok(response);
    }
}
