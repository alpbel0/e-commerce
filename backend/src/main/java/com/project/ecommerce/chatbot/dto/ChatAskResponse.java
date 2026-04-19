package com.project.ecommerce.chatbot.dto;

import java.util.UUID;

public record ChatAskResponse(
    UUID requestId,
    String answer,
    String language,
    ExecutionStepResponse[] executionSteps,
    TableResponse table,
    VisualizationResponse visualization,
    TechnicalResponse technical,
    ErrorResponse error
) {

    public record ExecutionStepResponse(
        String name,
        String status,
        String message
    ) {
    }

    public record TableResponse(
        String[] columns,
        Object[][] rows,
        int rowCount
    ) {
    }

    public record VisualizationResponse(
        String type,
        Object data
    ) {
    }

    public record TechnicalResponse(
        String generatedSql,
        String sqlSummary,
        int rowCount,
        long executionMs,
        int retryCount
    ) {
    }

    public record ErrorResponse(
        String code,
        String message
    ) {
    }
}
