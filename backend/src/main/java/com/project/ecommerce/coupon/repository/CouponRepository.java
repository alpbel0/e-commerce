package com.project.ecommerce.coupon.repository;

import com.project.ecommerce.coupon.domain.Coupon;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponRepository extends JpaRepository<Coupon, UUID> {

    @EntityGraph(attributePaths = {"store"})
    Optional<Coupon> findByStoreIdAndCodeIgnoreCaseAndActiveTrue(UUID storeId, String code);

    boolean existsByStoreIdAndCodeIgnoreCase(UUID storeId, String code);

    @EntityGraph(attributePaths = {"store"})
    List<Coupon> findByStoreId(UUID storeId);
}
