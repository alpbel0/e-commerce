package com.project.ecommerce.corporate.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.coupon.dto.CouponResponse;
import com.project.ecommerce.coupon.service.CouponManagementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/corporate")
public class CorporateCouponController {

    private final CouponManagementService couponManagementService;

    public CorporateCouponController(CouponManagementService couponManagementService) {
        this.couponManagementService = couponManagementService;
    }

    @GetMapping("/coupons")
    public ApiPageResponse<CouponResponse> listCorporateCoupons(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return couponManagementService.listCouponsForCurrentStore(page, size);
    }
}
