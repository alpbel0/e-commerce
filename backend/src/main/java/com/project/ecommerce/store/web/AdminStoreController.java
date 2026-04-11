package com.project.ecommerce.store.web;

import com.project.ecommerce.store.dto.StoreDetailResponse;
import com.project.ecommerce.store.dto.UpdateStoreStatusRequest;
import com.project.ecommerce.store.service.StoreService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stores")
public class AdminStoreController {

    private final StoreService storeService;

    public AdminStoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @PatchMapping("/{storeId}/status")
    public StoreDetailResponse updateStoreStatus(
        @PathVariable UUID storeId,
        @Valid @RequestBody UpdateStoreStatusRequest request
    ) {
        return storeService.updateStoreStatusAsAdmin(storeId, request);
    }
}
