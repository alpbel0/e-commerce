package com.project.ecommerce.chatbot.web;

import com.project.ecommerce.chatbot.config.ChatbotProperties;
import com.project.ecommerce.chatbot.dto.QueryExecutorRequest;
import com.project.ecommerce.chatbot.dto.QueryExecutorResponse;
import com.project.ecommerce.chatbot.service.QueryExecutorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/chat")
public class QueryExecutorController {

    private static final Logger log = LoggerFactory.getLogger(QueryExecutorController.class);

    private final QueryExecutorService queryExecutorService;
    private final ChatbotProperties chatbotProperties;

    public QueryExecutorController(
        QueryExecutorService queryExecutorService,
        ChatbotProperties chatbotProperties
    ) {
        this.queryExecutorService = queryExecutorService;
        this.chatbotProperties = chatbotProperties;
    }

    @PostMapping("/execute")
    public ResponseEntity<QueryExecutorResponse> executeQuery(
        @Valid @RequestBody QueryExecutorRequest request,
        HttpServletRequest httpRequest
    ) {
        // Validate X-AI-Service-Key header (shared secret)
        String providedKey = httpRequest.getHeader("X-AI-Service-Key");

        if (providedKey == null || providedKey.isBlank()) {
            log.warn("Query executor called without X-AI-Service-Key header: requestId={}", request.requestId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(QueryExecutorResponse.error(request.requestId(), "Missing X-AI-Service-Key header"));
        }

        if (!providedKey.equals(chatbotProperties.getAiServiceKey())) {
            log.warn("Query executor called with invalid X-AI-Service-Key: requestId={}", request.requestId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(QueryExecutorResponse.error(request.requestId(), "Invalid X-AI-Service-Key"));
        }

        log.info("Executing query: requestId={}, sqlHash={}",
            request.requestId(),
            hashSql(request.sql()));

        QueryExecutorResponse response = queryExecutorService.executeQuery(request);

        if (response.error() != null) {
            log.warn("Query execution error: requestId={}, error={}", request.requestId(), response.error());
            return ResponseEntity.ok(response); // Return 200 with error in body
        }

        log.info("Query executed successfully: requestId={}, rowCount={}, executionMs={}",
            request.requestId(), response.rowCount(), response.executionMs());

        return ResponseEntity.ok(response);
    }

    private String hashSql(String sql) {
        if (sql == null) return "null";
        // Simple hash for logging - not cryptographically secure
        int hash = sql.hashCode();
        return Integer.toHexString(hash);
    }
}
