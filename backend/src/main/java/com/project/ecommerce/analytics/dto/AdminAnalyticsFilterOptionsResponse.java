package com.project.ecommerce.analytics.dto;

import java.util.List;

public record AdminAnalyticsFilterOptionsResponse(
    List<AnalyticsFilterOptionResponse> stores,
    List<AnalyticsFilterOptionResponse> categories
) {
}
