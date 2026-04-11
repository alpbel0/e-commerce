package com.project.ecommerce.cart.repository;

import com.project.ecommerce.cart.domain.CartItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

    @EntityGraph(attributePaths = {"product", "product.store", "product.category"})
    List<CartItem> findByCartId(UUID cartId);

    @EntityGraph(attributePaths = {"product", "product.store", "product.category"})
    Optional<CartItem> findByCartIdAndProductId(UUID cartId, UUID productId);

    @EntityGraph(attributePaths = {"cart", "product", "product.store"})
    Optional<CartItem> findById(UUID id);

    boolean existsByCartIdAndProductStoreId(UUID cartId, UUID storeId);

    long countByCartId(UUID cartId);
}
