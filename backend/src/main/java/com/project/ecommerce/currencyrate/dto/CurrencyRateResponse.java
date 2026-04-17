package com.project.ecommerce.currencyrate.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CurrencyRateResponse(
    String baseCurrency,
    String targetCurrency,
    BigDecimal rate,
    LocalDateTime updatedAt
) {
}
