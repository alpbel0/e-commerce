package com.project.ecommerce.store.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.store.dto.StoreDetailResponse;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import com.project.ecommerce.store.dto.UpdateStoreStatusRequest;
import com.project.ecommerce.store.service.StoreService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stores")
public class AdminStoreController {

    private final StoreService storeService;

    public AdminStoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public ApiPageResponse<StoreSummaryResponse> listAllStores(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Boolean hasProducts,
        @RequestParam(required = false) Integer minProductCount,
        @RequestParam(required = false) Integer maxProductCount
    ) {
        return storeService.listStores(page, size, sort, status, q, hasProducts, minProductCount, maxProductCount);
    }

    @GetMapping("/{storeId}")
    public StoreDetailResponse getStore(@PathVariable UUID storeId) {
        return storeService.getStore(storeId);
    }

    @PatchMapping("/{storeId}/status")
    public StoreDetailResponse updateStoreStatus(
        @PathVariable UUID storeId,
        @Valid @RequestBody UpdateStoreStatusRequest request
    ) {
        return storeService.updateStoreStatusAsAdmin(storeId, request);
    }
}
