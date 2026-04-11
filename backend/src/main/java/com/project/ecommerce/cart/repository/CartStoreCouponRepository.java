package com.project.ecommerce.cart.repository;

import com.project.ecommerce.cart.domain.CartStoreCoupon;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartStoreCouponRepository extends JpaRepository<CartStoreCoupon, UUID> {

    @EntityGraph(attributePaths = {"store", "coupon", "coupon.store"})
    List<CartStoreCoupon> findByCartId(UUID cartId);

    @EntityGraph(attributePaths = {"store", "coupon", "coupon.store"})
    Optional<CartStoreCoupon> findByCartIdAndStoreId(UUID cartId, UUID storeId);

    void deleteByCartIdAndStoreId(UUID cartId, UUID storeId);
}
