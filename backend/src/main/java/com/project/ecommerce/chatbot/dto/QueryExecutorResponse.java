package com.project.ecommerce.chatbot.dto;

import java.util.UUID;

public record QueryExecutorResponse(
    UUID requestId,
    String[] columns,
    Object[][] rows,
    int rowCount,
    long executionMs,
    String error,
    boolean truncated,
    int originalRowCount
) {

    public static QueryExecutorResponse success(
        UUID requestId,
        String[] columns,
        Object[][] rows,
        long executionMs
    ) {
        return new QueryExecutorResponse(
            requestId,
            columns,
            rows,
            rows.length,
            executionMs,
            null,
            false,
            rows.length
        );
    }

    public static QueryExecutorResponse success(
        UUID requestId,
        String[] columns,
        Object[][] rows,
        int originalRowCount,
        long executionMs
    ) {
        boolean truncated = rows.length < originalRowCount;
        return new QueryExecutorResponse(
            requestId,
            columns,
            rows,
            rows.length,
            executionMs,
            null,
            truncated,
            originalRowCount
        );
    }

    public static QueryExecutorResponse error(UUID requestId, String errorMessage) {
        return new QueryExecutorResponse(
            requestId,
            null,
            null,
            0,
            0,
            errorMessage,
            false,
            0
        );
    }
}
