package com.project.ecommerce.store.service;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.store.dto.StoreDetailResponse;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import com.project.ecommerce.store.repository.StoreRepository;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StoreService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final StoreRepository storeRepository;

    public StoreService(StoreRepository storeRepository) {
        this.storeRepository = storeRepository;
    }

    public ApiPageResponse<StoreSummaryResponse> listStores(Integer page, Integer size, String sort, String status) {
        Pageable pageable = buildPageable(page, size, sort);
        var resultPage = status == null || status.isBlank()
            ? storeRepository.findAll(pageable)
            : storeRepository.findAllByStatusOrderByNameAsc(status.trim().toUpperCase(), pageable);
        var items = resultPage.stream().map(store -> new StoreSummaryResponse(
            store.getId(),
            store.getName(),
            store.getContactEmail(),
            store.getStatus(),
            store.getProductCount(),
            store.getOwner() != null ? store.getOwner().getEmail() : null
        )).toList();
        return new ApiPageResponse<>(items, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    public StoreDetailResponse getStore(UUID storeId) {
        var store = storeRepository.findById(storeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return new StoreDetailResponse(
            store.getId(),
            store.getName(),
            store.getDescription(),
            store.getContactEmail(),
            store.getContactPhone(),
            store.getAddress(),
            store.getTotalSales(),
            store.getProductCount(),
            store.getRating(),
            store.getStatus(),
            store.getOwner().getId(),
            store.getCreatedAt(),
            store.getUpdatedAt()
        );
    }

    private Pageable buildPageable(Integer page, Integer size, String sortExpression) {
        int resolvedPage = page == null ? DEFAULT_PAGE : Math.max(page, 0);
        int resolvedSize = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        Sort sort = parseSort(sortExpression);
        return PageRequest.of(resolvedPage, resolvedSize, sort);
    }

    private Sort parseSort(String sortExpression) {
        if (sortExpression == null || sortExpression.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "name");
        }

        String[] parts = sortExpression.split(",", 2);
        String property = switch (parts[0].trim()) {
            case "createdAt" -> "createdAt";
            case "totalSales" -> "totalSales";
            case "name" -> "name";
            default -> "name";
        };
        Sort.Direction direction = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;
        return Sort.by(direction, property);
    }
}
