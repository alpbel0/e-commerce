package com.project.ecommerce.chatbot.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting filter using Token Bucket algorithm (Bucket4j).
 *
 * Applies to internal chatbot endpoints:
 * - /internal/chat/execute
 * - /internal/schema
 *
 * Each X-AI-Service-Key gets its own bucket.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final int requestsPerMinute;
    private final int burstSize;

    public RateLimitFilter(ChatbotProperties chatbotProperties) {
        this.requestsPerMinute = chatbotProperties.getRateLimitRequestsPerMinute();
        this.burstSize = chatbotProperties.getRateLimitBurstSize();
        log.info("RateLimitFilter initialized: requestsPerMinute={}, burstSize={}",
            requestsPerMinute, burstSize);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();

        // Only apply rate limiting to internal chatbot endpoints
        if (!path.startsWith("/internal/chat") && !path.startsWith("/internal/schema")) {
            filterChain.doFilter(request, response);
            return;
        }

        String serviceKey = request.getHeader("X-AI-Service-Key");
        String bucketKey = bucketKey(serviceKey);

        Bucket bucket = buckets.computeIfAbsent(bucketKey, k -> createNewBucket());

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for serviceKeyHash={}, path={}", bucketKey, path);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please try again later.\"}"
            );
        }
    }

    private Bucket createNewBucket() {
        // Token Bucket: refill rate requestsPerMinute, allow burstSize burst
        Refill refill = Refill.greedy(requestsPerMinute, Duration.ofMinutes(1));
        return Bucket.builder()
            .addLimit(Bandwidth.classic(burstSize, refill))
            .build();
    }

    private String bucketKey(String serviceKey) {
        if (serviceKey == null || serviceKey.isBlank()) {
            return "anonymous";
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(serviceKey.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            return "configured-service";
        }
    }
}
