package com.project.ecommerce.store.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.store.dto.StoreDetailResponse;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import com.project.ecommerce.store.service.StoreService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stores")
public class StoreController {

    private final StoreService storeService;

    public StoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public ApiPageResponse<StoreSummaryResponse> listStores(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String status
    ) {
        return storeService.listStores(page, size, sort, status);
    }

    @GetMapping("/{storeId}")
    public StoreDetailResponse getStore(@PathVariable UUID storeId) {
        return storeService.getStore(storeId);
    }
}
