package com.project.ecommerce.review.repository;

import com.project.ecommerce.review.domain.ReviewResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewResponseRepository extends JpaRepository<ReviewResponse, UUID> {

    @EntityGraph(attributePaths = {"responderUser"})
    List<ReviewResponse> findByReviewIdOrderByCreatedAtAsc(UUID reviewId);
}
