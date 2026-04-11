package com.project.ecommerce.review.repository;

import com.project.ecommerce.review.domain.Review;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    @EntityGraph(attributePaths = {"user", "product", "product.store", "order"})
    Page<Review> findByProductId(UUID productId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"user", "product", "product.store", "order"})
    Optional<Review> findById(UUID id);

    boolean existsByUserIdAndOrderIdAndProductId(UUID userId, UUID orderId, UUID productId);

    @Query("""
        select
            count(r) as reviewCount,
            avg(r.starRating) as averageRating
        from Review r
        where r.product.id = :productId
        """)
    ReviewStats calculateStatsByProductId(UUID productId);

    interface ReviewStats {
        long getReviewCount();
        Double getAverageRating();
    }
}
