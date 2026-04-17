package com.project.ecommerce.coupon.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.coupon.dto.CouponResponse;
import com.project.ecommerce.coupon.dto.CreateCouponRequest;
import com.project.ecommerce.coupon.dto.UpdateCouponRequest;
import com.project.ecommerce.coupon.service.CouponManagementService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/coupons")
public class CouponManagementController {

    private final CouponManagementService couponManagementService;

    public CouponManagementController(CouponManagementService couponManagementService) {
        this.couponManagementService = couponManagementService;
    }

    @GetMapping
    public ApiPageResponse<CouponResponse> listCoupons(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) UUID storeId
    ) {
        return couponManagementService.listCoupons(page, size, storeId);
    }

    @GetMapping("/{couponId}")
    public CouponResponse getCoupon(@PathVariable UUID couponId) {
        return couponManagementService.getCoupon(couponId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CouponResponse createCoupon(@Valid @RequestBody CreateCouponRequest request) {
        return couponManagementService.createCoupon(request);
    }

    @PatchMapping("/{couponId}")
    public CouponResponse updateCoupon(@PathVariable UUID couponId, @Valid @RequestBody UpdateCouponRequest request) {
        return couponManagementService.updateCoupon(couponId, request);
    }

    @DeleteMapping("/{couponId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCoupon(@PathVariable UUID couponId) {
        couponManagementService.deleteCoupon(couponId);
    }
}
