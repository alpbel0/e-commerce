package com.project.ecommerce.store.web;

import com.project.ecommerce.auth.service.AccessScopeService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/corporate")
@SecurityRequirement(name = "bearerAuth")
public class CorporateStoreController {

    private final AccessScopeService accessScopeService;

    public CorporateStoreController(AccessScopeService accessScopeService) {
        this.accessScopeService = accessScopeService;
    }

    @GetMapping("/stores")
    public List<StoreSummaryResponse> myStores() {
        return accessScopeService.currentCorporateStores();
    }
}
