package com.project.ecommerce.store.service;

import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.dto.CreateStoreRequest;
import com.project.ecommerce.store.dto.StoreDetailResponse;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import com.project.ecommerce.store.dto.UpdateStoreRequest;
import com.project.ecommerce.store.dto.UpdateStoreStatusRequest;
import com.project.ecommerce.store.repository.StoreRepository;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StoreService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final String STORE_OPEN = "OPEN";
    private static final String STORE_CLOSED = "CLOSED";
    private static final String STORE_SUSPENDED = "SUSPENDED";
    private static final Set<String> CORPORATE_ALLOWED_STATUSES = Set.of(STORE_OPEN, STORE_CLOSED);
    private static final Set<String> ADMIN_ALLOWED_STATUSES = Set.of(STORE_OPEN, STORE_CLOSED, STORE_SUSPENDED);

    private final StoreRepository storeRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final JdbcTemplate jdbcTemplate;

    public StoreService(
        StoreRepository storeRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        JdbcTemplate jdbcTemplate
    ) {
        this.storeRepository = storeRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public ApiPageResponse<StoreSummaryResponse> listStores(
        Integer page,
        Integer size,
        String sort,
        String status,
        String q,
        Boolean hasProducts,
        Integer minProductCount,
        Integer maxProductCount
    ) {
        syncStoreProductCounts();
        Pageable pageable = buildPageable(page, size, sort);
        Specification<Store> specification = buildStoreSpecification(status, q, hasProducts, minProductCount, maxProductCount);
        var resultPage = storeRepository.findAll(specification, pageable);
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
        syncStoreProductCounts();
        var store = storeRepository.findById(storeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return toDetailResponse(store);
    }

    public StoreDetailResponse getStoreBySlug(String slug) {
        syncStoreProductCounts();
        var store = storeRepository.findBySlug(slug)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return toDetailResponse(store);
    }

    public ApiPageResponse<StoreSummaryResponse> getStoresByOwner(UUID ownerId, Integer page, Integer size) {
        syncStoreProductCounts();
        Pageable pageable = PageRequest.of(page == null ? 0 : page, size == null ? 20 : size);
        var resultPage = storeRepository.findByOwnerId(ownerId, pageable);
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

    @Transactional
    @PreAuthorize("hasRole('CORPORATE')")
    public StoreDetailResponse createCorporateStore(CreateStoreRequest request) {
        AuthenticatedUser currentUser = currentUserService.requireAuthenticatedUser();

        Store store = new Store();
        store.setId(UUID.randomUUID());
        store.setOwner(currentUserService.requireCurrentAppUser());
        store.setName(request.name().trim());
        store.setDescription(blankToNull(request.description()));
        store.setContactEmail(request.contactEmail() != null ? request.contactEmail().trim() : null);
        store.setContactPhone(blankToNull(request.contactPhone()));
        store.setAddress(blankToNull(request.address()));
        store.setTotalSales(java.math.BigDecimal.ZERO);
        store.setProductCount(0);
        store.setStatus("PENDING");
        store.setSlug(generateSlug(request.name()));
        storeRepository.save(store);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STORE_CREATED",
            Map.of("storeId", store.getId(), "name", store.getName())
        );
        return toDetailResponse(store);
    }

    @Transactional
    @PreAuthorize("hasRole('CORPORATE')")
    public StoreDetailResponse updateCorporateStore(UUID storeId, UpdateStoreRequest request) {
        AuthenticatedUser currentUser = currentUserService.requireAuthenticatedUser();
        Store store = storeRepository.findByIdAndOwnerId(storeId, currentUser.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot manage another seller's store"));

        String previousStatus = store.getStatus();
        applyStorePatch(store, request);

        if (request.status() != null) {
            String nextStatus = normalizeStatus(request.status());
            if (!CORPORATE_ALLOWED_STATUSES.contains(nextStatus)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corporate users can only set store status to OPEN or CLOSED");
            }
            if (STORE_SUSPENDED.equals(previousStatus) && STORE_OPEN.equals(nextStatus)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Suspended stores cannot be reopened by the seller");
            }
            store.setStatus(nextStatus);
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STORE_UPDATED",
            Map.of(
                "storeId", store.getId(),
                "oldStatus", previousStatus,
                "newStatus", store.getStatus()
            )
        );
        return toDetailResponse(store);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public StoreDetailResponse updateStoreStatusAsAdmin(UUID storeId, UpdateStoreStatusRequest request) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        String nextStatus = normalizeStatus(request.status());
        if (!ADMIN_ALLOWED_STATUSES.contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported store status");
        }

        String previousStatus = store.getStatus();
        store.setStatus(nextStatus);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "STORE_STATUS_UPDATED",
            Map.of(
                "storeId", store.getId(),
                "oldStatus", previousStatus,
                "newStatus", nextStatus
            )
        );
        return toDetailResponse(store);
    }

    private Pageable buildPageable(Integer page, Integer size, String sortExpression) {
        int resolvedPage = page == null ? DEFAULT_PAGE : Math.max(page, 0);
        int resolvedSize = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        Sort sort = parseSort(sortExpression);
        return PageRequest.of(resolvedPage, resolvedSize, sort);
    }

    private Specification<Store> buildStoreSpecification(
        String status,
        String q,
        Boolean hasProducts,
        Integer minProductCount,
        Integer maxProductCount
    ) {
        Specification<Store> specification = Specification.where(null);

        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toUpperCase();
            specification = specification.and((root, query, cb) -> cb.equal(root.get("status"), normalizedStatus));
        }

        if (q != null && !q.isBlank()) {
            String like = "%" + q.trim().toLowerCase() + "%";
            specification = specification.and((root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("name")), like),
                cb.like(cb.lower(root.get("contactEmail")), like),
                cb.like(cb.lower(root.join("owner").get("email")), like)
            ));
        }

        if (hasProducts != null) {
            specification = specification.and((root, query, cb) -> hasProducts
                ? cb.greaterThan(root.get("productCount"), 0)
                : cb.or(
                    cb.equal(root.get("productCount"), 0),
                    cb.isNull(root.get("productCount"))
                ));
        }

        if (minProductCount != null) {
            specification = specification.and((root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("productCount"), minProductCount)
            );
        }

        if (maxProductCount != null) {
            specification = specification.and((root, query, cb) ->
                cb.lessThanOrEqualTo(root.get("productCount"), maxProductCount)
            );
        }

        return specification;
    }

    private Sort parseSort(String sortExpression) {
        if (sortExpression == null || sortExpression.isBlank()) {
            return Sort.by(Sort.Direction.ASC, "name");
        }

        String[] parts = sortExpression.split(",", 2);
        String property = switch (parts[0].trim()) {
            case "createdAt" -> "createdAt";
            case "totalSales" -> "totalSales";
            case "productCount" -> "productCount";
            case "name" -> "name";
            default -> "name";
        };
        Sort.Direction direction = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;
        return Sort.by(direction, property);
    }

    private void applyStorePatch(Store store, UpdateStoreRequest request) {
        if (request.name() != null) {
            store.setName(request.name().trim());
        }
        if (request.description() != null) {
            store.setDescription(blankToNull(request.description()));
        }
        if (request.contactEmail() != null) {
            store.setContactEmail(request.contactEmail().trim());
        }
        if (request.contactPhone() != null) {
            store.setContactPhone(request.contactPhone().trim());
        }
    }

    private StoreDetailResponse toDetailResponse(Store store) {
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
            store.getSlug(),
            store.getOwner().getId(),
            store.getCreatedAt(),
            store.getUpdatedAt()
        );
    }

    private String normalizeStatus(String status) {
        return status.trim().toUpperCase();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String generateSlug(String name) {
        String slug = name.toLowerCase(java.util.Locale.ENGLISH)
            .replaceAll("[^a-z0-9\\s-]", "")
            .replaceAll("\\s+", "-")
            .replaceAll("-+", "-")
            .trim();
        return slug + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private void syncStoreProductCounts() {
        jdbcTemplate.update("""
            UPDATE stores s
            SET product_count = (
                SELECT COUNT(*)
                FROM products p
                WHERE p.store_id = s.id
            )
        """);
    }
}
