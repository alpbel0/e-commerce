package com.project.ecommerce.currencyrate.web;

import com.project.ecommerce.currencyrate.dto.CurrencyRateResponse;
import com.project.ecommerce.currencyrate.service.CurrencyRateService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/currency-rates")
public class CurrencyRateController {

    private final CurrencyRateService currencyRateService;

    public CurrencyRateController(CurrencyRateService currencyRateService) {
        this.currencyRateService = currencyRateService;
    }

    @GetMapping
    public List<CurrencyRateResponse> listRates() {
        return currencyRateService.listUsdRates();
    }
}
