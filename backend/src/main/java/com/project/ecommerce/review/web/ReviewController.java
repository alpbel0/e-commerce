package com.project.ecommerce.review.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.review.dto.CreateReviewRequest;
import com.project.ecommerce.review.dto.CreateReviewResponseRequest;
import com.project.ecommerce.review.dto.ReviewDto;
import com.project.ecommerce.review.dto.ReviewResponseDto;
import com.project.ecommerce.review.dto.UpdateReviewRequest;
import com.project.ecommerce.review.service.ReviewService;
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
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewDto createReview(@Valid @RequestBody CreateReviewRequest request) {
        return reviewService.createReview(request);
    }

    @GetMapping
    public ApiPageResponse<ReviewDto> listReviews(
        @RequestParam UUID productId,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String sort
    ) {
        return reviewService.listReviews(productId, page, size, sort);
    }

    @GetMapping("/{reviewId}")
    public ReviewDto getReview(@PathVariable UUID reviewId) {
        return reviewService.getReview(reviewId);
    }

    @PatchMapping("/{reviewId}")
    public ReviewDto updateReview(@PathVariable UUID reviewId, @Valid @RequestBody UpdateReviewRequest request) {
        return reviewService.updateReview(reviewId, request);
    }

    @DeleteMapping("/{reviewId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(@PathVariable UUID reviewId) {
        reviewService.deleteReview(reviewId);
    }

    @PostMapping("/{reviewId}/responses")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponseDto createReviewResponse(
        @PathVariable UUID reviewId,
        @Valid @RequestBody CreateReviewResponseRequest request
    ) {
        return reviewService.createReviewResponse(reviewId, request);
    }
}
