package com.project.ecommerce.coupon.service;

import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.coupon.domain.Coupon;
import com.project.ecommerce.coupon.dto.CouponResponse;
import com.project.ecommerce.coupon.dto.CreateCouponRequest;
import com.project.ecommerce.coupon.dto.UpdateCouponRequest;
import com.project.ecommerce.coupon.repository.CouponRepository;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CouponManagementService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final CouponRepository couponRepository;
    private final StoreRepository storeRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public CouponManagementService(
        CouponRepository couponRepository,
        StoreRepository storeRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.couponRepository = couponRepository;
        this.storeRepository = storeRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    @PreAuthorize("hasRole('CORPORATE')")
    public ApiPageResponse<CouponResponse> listCouponsForCurrentStore(Integer page, Integer size) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        Pageable pageable = PageRequest.of(
            page == null ? DEFAULT_PAGE : Math.max(page, 0),
            size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE),
            Sort.by(Sort.Direction.DESC, "createdAt")
        );
        Page<Coupon> resultPage = couponRepository.findByStoreOwnerId(authenticatedUser.getUserId(), pageable);
        var items = resultPage.stream().map(this::toResponse).toList();
        return new ApiPageResponse<>(items, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'CORPORATE')")
    public ApiPageResponse<CouponResponse> listCoupons(Integer page, Integer size, UUID storeId) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        Pageable pageable = PageRequest.of(
            page == null ? DEFAULT_PAGE : Math.max(page, 0),
            size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE),
            Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<Coupon> resultPage = switch (authenticatedUser.getActiveRole()) {
            case ADMIN -> storeId == null
                ? couponRepository.findAll(pageable)
                : couponRepository.findByStoreId(storeId, pageable);
            case CORPORATE -> {
                if (storeId != null) {
                    requireManagedStore(storeId, authenticatedUser);
                    yield couponRepository.findByStoreOwnerIdAndStoreId(authenticatedUser.getUserId(), storeId, pageable);
                }
                yield couponRepository.findByStoreOwnerId(authenticatedUser.getUserId(), pageable);
            }
            default -> throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        };

        var items = resultPage.stream().map(this::toResponse).toList();
        return new ApiPageResponse<>(items, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'CORPORATE')")
    public CouponResponse getCoupon(UUID couponId) {
        Coupon coupon = couponRepository.findById(couponId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon not found"));
        authorizeCouponAccess(coupon);
        return toResponse(coupon);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'CORPORATE')")
    public CouponResponse createCoupon(CreateCouponRequest request) {
        Store store = resolveManagedStore(request.storeId());
        String normalizedCode = normalizeCode(request.code());
        ensureCodeAvailable(store.getId(), normalizedCode, null);

        Coupon coupon = new Coupon();
        coupon.setId(UUID.randomUUID());
        coupon.setStore(store);
        coupon.setCode(normalizedCode);
        coupon.setDiscountPercentage(money(request.discountPercentage()));
        coupon.setValidUntil(request.validUntil());
        coupon.setActive(request.active() == null || request.active());
        couponRepository.save(coupon);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "COUPON_CREATED",
            Map.of(
                "couponId", coupon.getId(),
                "storeId", store.getId(),
                "code", coupon.getCode()
            )
        );
        return toResponse(coupon);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'CORPORATE')")
    public CouponResponse updateCoupon(UUID couponId, UpdateCouponRequest request) {
        Coupon coupon = couponRepository.findById(couponId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon not found"));
        authorizeCouponAccess(coupon);

        Store targetStore = coupon.getStore();
        if (request.storeId() != null && !request.storeId().equals(coupon.getStore().getId())) {
            targetStore = resolveManagedStore(request.storeId());
            coupon.setStore(targetStore);
        }

        if (request.code() != null && !request.code().isBlank()) {
            String normalizedCode = normalizeCode(request.code());
            ensureCodeAvailable(targetStore.getId(), normalizedCode, coupon.getId());
            coupon.setCode(normalizedCode);
        }
        if (request.discountPercentage() != null) {
            coupon.setDiscountPercentage(money(request.discountPercentage()));
        }
        if (request.validUntil() != null) {
            coupon.setValidUntil(request.validUntil());
        }
        if (request.active() != null) {
            coupon.setActive(request.active());
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "COUPON_UPDATED",
            Map.of(
                "couponId", coupon.getId(),
                "storeId", coupon.getStore().getId(),
                "code", coupon.getCode(),
                "active", coupon.isActive()
            )
        );
        return toResponse(coupon);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'CORPORATE')")
    public void deleteCoupon(UUID couponId) {
        Coupon coupon = couponRepository.findById(couponId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon not found"));
        authorizeCouponAccess(coupon);

        coupon.setActive(false);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "COUPON_DELETED",
            Map.of(
                "couponId", coupon.getId(),
                "storeId", coupon.getStore().getId(),
                "code", coupon.getCode()
            )
        );
    }

    private void authorizeCouponAccess(Coupon coupon) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return;
        }
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE
            && coupon.getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private Store resolveManagedStore(UUID storeId) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return storeRepository.findById(storeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        }
        if (authenticatedUser.getActiveRole() == RoleType.CORPORATE) {
            return storeRepository.findByIdAndOwnerId(storeId, authenticatedUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot manage coupons for another store"));
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private void requireManagedStore(UUID storeId, AuthenticatedUser authenticatedUser) {
        if (authenticatedUser.getActiveRole() == RoleType.ADMIN) {
            return;
        }
        if (storeRepository.findByIdAndOwnerId(storeId, authenticatedUser.getUserId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot manage coupons for another store");
        }
    }

    private void ensureCodeAvailable(UUID storeId, String code, UUID currentCouponId) {
        boolean exists = currentCouponId == null
            ? couponRepository.existsByStoreIdAndCodeIgnoreCase(storeId, code)
            : couponRepository.existsByStoreIdAndCodeIgnoreCaseAndIdNot(storeId, code, currentCouponId);
        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Coupon code already exists for this store");
        }
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase();
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private CouponResponse toResponse(Coupon coupon) {
        return new CouponResponse(
            coupon.getId(),
            coupon.getStore().getId(),
            coupon.getStore().getName(),
            coupon.getCode(),
            money(coupon.getDiscountPercentage()),
            coupon.isActive(),
            coupon.getValidUntil(),
            coupon.getCreatedAt()
        );
    }
}
