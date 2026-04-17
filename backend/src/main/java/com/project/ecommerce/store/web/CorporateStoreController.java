package com.project.ecommerce.store.web;

import com.project.ecommerce.auth.service.AccessScopeService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import com.project.ecommerce.store.dto.CreateStoreRequest;
import com.project.ecommerce.store.dto.StoreDetailResponse;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import com.project.ecommerce.store.dto.UpdateStoreRequest;
import com.project.ecommerce.store.service.StoreService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/corporate")
@SecurityRequirement(name = "bearerAuth")
public class CorporateStoreController {

    private final AccessScopeService accessScopeService;
    private final StoreService storeService;

    public CorporateStoreController(AccessScopeService accessScopeService, StoreService storeService) {
        this.accessScopeService = accessScopeService;
        this.storeService = storeService;
    }

    @GetMapping("/stores")
    public List<StoreSummaryResponse> myStores() {
        return accessScopeService.currentCorporateStores();
    }

    @PostMapping("/stores")
    @ResponseStatus(HttpStatus.CREATED)
    public StoreDetailResponse createMyStore(@Valid @RequestBody CreateStoreRequest request) {
        return storeService.createCorporateStore(request);
    }

    @PatchMapping("/stores/{storeId}")
    public StoreDetailResponse updateMyStore(
        @PathVariable UUID storeId,
        @Valid @RequestBody UpdateStoreRequest request
    ) {
        return storeService.updateCorporateStore(storeId, request);
    }
}
