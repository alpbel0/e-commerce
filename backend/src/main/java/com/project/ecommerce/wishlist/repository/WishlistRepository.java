package com.project.ecommerce.wishlist.repository;

import com.project.ecommerce.wishlist.domain.Wishlist;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface WishlistRepository extends JpaRepository<Wishlist, UUID> {

    @EntityGraph(attributePaths = {"product", "product.store"})
    List<Wishlist> findByUserId(UUID userId);

    boolean existsByUserIdAndProductId(UUID userId, UUID productId);

    @Modifying
    @Query("delete from Wishlist w where w.user.id = :userId and w.product.id = :productId")
    int deleteByUserIdAndProductId(UUID userId, UUID productId);

    @EntityGraph(attributePaths = {"product", "product.store"})
    Optional<Wishlist> findByUserIdAndProductId(UUID userId, UUID productId);
}
