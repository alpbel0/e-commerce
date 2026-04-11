package com.project.ecommerce.coupon.repository;

import com.project.ecommerce.coupon.domain.Coupon;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponRepository extends JpaRepository<Coupon, UUID> {

    @Override
    @EntityGraph(attributePaths = {"store", "store.owner"})
    Optional<Coupon> findById(UUID id);

    @EntityGraph(attributePaths = {"store"})
    Optional<Coupon> findByStoreIdAndCodeIgnoreCaseAndActiveTrue(UUID storeId, String code);

    boolean existsByStoreIdAndCodeIgnoreCase(UUID storeId, String code);

    boolean existsByStoreIdAndCodeIgnoreCaseAndIdNot(UUID storeId, String code, UUID id);

    @Override
    @EntityGraph(attributePaths = {"store", "store.owner"})
    Page<Coupon> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"store", "store.owner"})
    Page<Coupon> findByStoreId(UUID storeId, Pageable pageable);

    @EntityGraph(attributePaths = {"store", "store.owner"})
    Page<Coupon> findByStoreOwnerId(UUID ownerId, Pageable pageable);

    @EntityGraph(attributePaths = {"store", "store.owner"})
    Page<Coupon> findByStoreOwnerIdAndStoreId(UUID ownerId, UUID storeId, Pageable pageable);

    @EntityGraph(attributePaths = {"store"})
    List<Coupon> findByStoreId(UUID storeId);
}
