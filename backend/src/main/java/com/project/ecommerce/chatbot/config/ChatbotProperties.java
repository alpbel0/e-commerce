package com.project.ecommerce.chatbot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.chatbot")
public class ChatbotProperties {

    private String aiServiceUrl = "http://localhost:8000";
    private String aiServiceKey = "change-me-in-production";
    private int connectionTimeoutSeconds = 30;
    private int readTimeoutSeconds = 60;
    private int queryTimeoutSeconds = 10;
    private int schemaCacheTtlSeconds = 300;
    private int rateLimitRequestsPerMinute = 60;
    private int rateLimitBurstSize = 10;

    public String getAiServiceUrl() {
        return aiServiceUrl;
    }

    public void setAiServiceUrl(String aiServiceUrl) {
        this.aiServiceUrl = aiServiceUrl;
    }

    public String getAiServiceKey() {
        return aiServiceKey;
    }

    public void setAiServiceKey(String aiServiceKey) {
        this.aiServiceKey = aiServiceKey;
    }

    public int getConnectionTimeoutSeconds() {
        return connectionTimeoutSeconds;
    }

    public void setConnectionTimeoutSeconds(int connectionTimeoutSeconds) {
        this.connectionTimeoutSeconds = connectionTimeoutSeconds;
    }

    public int getReadTimeoutSeconds() {
        return readTimeoutSeconds;
    }

    public void setReadTimeoutSeconds(int readTimeoutSeconds) {
        this.readTimeoutSeconds = readTimeoutSeconds;
    }

    public int getQueryTimeoutSeconds() {
        return queryTimeoutSeconds;
    }

    public void setQueryTimeoutSeconds(int queryTimeoutSeconds) {
        this.queryTimeoutSeconds = queryTimeoutSeconds;
    }

    public int getSchemaCacheTtlSeconds() {
        return schemaCacheTtlSeconds;
    }

    public void setSchemaCacheTtlSeconds(int schemaCacheTtlSeconds) {
        this.schemaCacheTtlSeconds = schemaCacheTtlSeconds;
    }

    public int getRateLimitRequestsPerMinute() {
        return rateLimitRequestsPerMinute;
    }

    public void setRateLimitRequestsPerMinute(int rateLimitRequestsPerMinute) {
        this.rateLimitRequestsPerMinute = rateLimitRequestsPerMinute;
    }

    public int getRateLimitBurstSize() {
        return rateLimitBurstSize;
    }

    public void setRateLimitBurstSize(int rateLimitBurstSize) {
        this.rateLimitBurstSize = rateLimitBurstSize;
    }
}
