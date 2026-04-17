package com.project.ecommerce.currencyrate.repository;

import com.project.ecommerce.currencyrate.domain.CurrencyRate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CurrencyRateRepository extends JpaRepository<CurrencyRate, Integer> {

    Optional<CurrencyRate> findByBaseCurrencyAndTargetCurrency(String baseCurrency, String targetCurrency);
}
