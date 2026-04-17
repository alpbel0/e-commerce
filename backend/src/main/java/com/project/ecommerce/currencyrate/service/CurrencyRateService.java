package com.project.ecommerce.currencyrate.service;

import com.project.ecommerce.currencyrate.repository.CurrencyRateRepository;
import com.project.ecommerce.currencyrate.dto.CurrencyRateResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CurrencyRateService {

    private static final String USD = "USD";

    private final CurrencyRateRepository currencyRateRepository;

    public CurrencyRateService(CurrencyRateRepository currencyRateRepository) {
        this.currencyRateRepository = currencyRateRepository;
    }

    public BigDecimal convertToUsd(BigDecimal amount, String fromCurrency) {
        if (amount == null) {
            return BigDecimal.ZERO;
        }
        String normalizedFrom = normalizeCurrency(fromCurrency);
        if (USD.equals(normalizedFrom)) {
            return amount;
        }
        BigDecimal usdToTargetRate = getRate(USD, normalizedFrom);
        return amount.divide(usdToTargetRate, 6, RoundingMode.HALF_UP);
    }

    public BigDecimal convertBetween(BigDecimal amount, String fromCurrency, String toCurrency) {
        if (amount == null) {
            return BigDecimal.ZERO;
        }
        String normalizedFrom = normalizeCurrency(fromCurrency);
        String normalizedTo = normalizeCurrency(toCurrency);
        if (normalizedFrom.equals(normalizedTo)) {
            return amount;
        }
        BigDecimal usdAmount = convertToUsd(amount, normalizedFrom);
        if (USD.equals(normalizedTo)) {
            return usdAmount;
        }
        return usdAmount.multiply(getRate(USD, normalizedTo)).setScale(6, RoundingMode.HALF_UP);
    }

    public List<CurrencyRateResponse> listUsdRates() {
        return currencyRateRepository.findAll().stream()
            .filter(rate -> USD.equals(normalizeCurrency(rate.getBaseCurrency())))
            .sorted(Comparator.comparing(rate -> rate.getTargetCurrency().toUpperCase()))
            .map(rate -> new CurrencyRateResponse(
                normalizeCurrency(rate.getBaseCurrency()),
                normalizeCurrency(rate.getTargetCurrency()),
                rate.getRate().setScale(6, RoundingMode.HALF_UP),
                rate.getUpdatedAt()
            ))
            .toList();
    }

    private BigDecimal getRate(String baseCurrency, String targetCurrency) {
        return currencyRateRepository.findByBaseCurrencyAndTargetCurrency(baseCurrency, targetCurrency)
            .map(rate -> rate.getRate().setScale(6, RoundingMode.HALF_UP))
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "Currency rate not found for " + baseCurrency + " -> " + targetCurrency
            ));
    }

    private String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency is required");
        }
        return currency.trim().toUpperCase();
    }
}
