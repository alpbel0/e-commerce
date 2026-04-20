package com.project.ecommerce.analytics.dto;

import java.util.UUID;

public record AnalyticsFilterOptionResponse(
    UUID id,
    String label
) {
}
