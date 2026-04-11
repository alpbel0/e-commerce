package com.project.ecommerce.coupon.seed;

import com.project.ecommerce.coupon.domain.Coupon;
import com.project.ecommerce.coupon.repository.CouponRepository;
import com.project.ecommerce.store.repository.StoreRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!test")
public class CouponSeeder implements CommandLineRunner {

    private final CouponRepository couponRepository;
    private final StoreRepository storeRepository;

    public CouponSeeder(CouponRepository couponRepository, StoreRepository storeRepository) {
        this.couponRepository = couponRepository;
        this.storeRepository = storeRepository;
    }

    @Override
    public void run(String... args) {
        seedCoupon("Demo Corporate Store", "WELCOME10", BigDecimal.TEN);
        seedCoupon("Second Demo Store", "YAZ20", new BigDecimal("20.00"));
        seedCoupon("ONLINE_RETAIL_STORE", "SPRING15", new BigDecimal("15.00"));
    }

    private void seedCoupon(String storeName, String code, BigDecimal discountPercentage) {
        storeRepository.findByNameIgnoreCase(storeName).ifPresent(store -> {
            if (couponRepository.existsByStoreIdAndCodeIgnoreCase(store.getId(), code)) {
                return;
            }

            Coupon coupon = new Coupon();
            coupon.setId(UUID.randomUUID());
            coupon.setStore(store);
            coupon.setCode(code);
            coupon.setDiscountPercentage(discountPercentage);
            coupon.setActive(true);
            coupon.setValidUntil(LocalDateTime.now().plusYears(1));
            couponRepository.save(coupon);
        });
    }
}
