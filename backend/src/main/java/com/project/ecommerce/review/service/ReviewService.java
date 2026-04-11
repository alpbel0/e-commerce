package com.project.ecommerce.review.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.notification.service.NotificationService;
import com.project.ecommerce.order.repository.OrderItemRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.review.domain.Review;
import com.project.ecommerce.review.domain.ReviewResponse;
import com.project.ecommerce.review.dto.CreateReviewRequest;
import com.project.ecommerce.review.dto.CreateReviewResponseRequest;
import com.project.ecommerce.review.dto.ReviewDto;
import com.project.ecommerce.review.dto.ReviewResponseDto;
import com.project.ecommerce.review.dto.UpdateReviewRequest;
import com.project.ecommerce.review.repository.ReviewRepository;
import com.project.ecommerce.review.repository.ReviewResponseRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReviewService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 100;
    private static final String DELIVERED_STATUS = "DELIVERED";
    private static final String REVIEW_NOTIFICATION_TYPE = "REVIEW_UPDATED";

    private final ReviewRepository reviewRepository;
    private final ReviewResponseRepository reviewResponseRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    public ReviewService(
        ReviewRepository reviewRepository,
        ReviewResponseRepository reviewResponseRepository,
        OrderRepository orderRepository,
        OrderItemRepository orderItemRepository,
        ProductRepository productRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        NotificationService notificationService
    ) {
        this.reviewRepository = reviewRepository;
        this.reviewResponseRepository = reviewResponseRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productRepository = productRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public ReviewDto createReview(CreateReviewRequest request) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.INDIVIDUAL) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only individual users can create reviews");
        }

        var currentUser = currentUserService.requireCurrentAppUser();
        var order = orderRepository.findById(request.orderId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!order.getUser().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only review your own orders");
        }
        if (!DELIVERED_STATUS.equalsIgnoreCase(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review requires a delivered order");
        }

        Product product = productRepository.findById(request.productId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        boolean verifiedPurchase = orderItemRepository.existsByOrderUserIdAndOrderIdAndProductId(
            currentUser.getId(),
            order.getId(),
            product.getId()
        );
        if (!verifiedPurchase) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review requires a verified purchase for the selected order and product");
        }

        if (reviewRepository.existsByUserIdAndProductIdAndActiveTrue(currentUser.getId(), product.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have an active review for this product");
        }

        Review review = new Review();
        review.setId(UUID.randomUUID());
        review.setUser(currentUser);
        review.setProduct(product);
        review.setOrder(order);
        review.setStarRating(request.starRating());
        review.setReviewTitle(request.reviewTitle().trim());
        review.setReviewText(request.reviewText().trim());
        review.setReviewImages(request.reviewImages());
        review.setVerifiedPurchase(true);
        review.setActive(true);
        reviewRepository.save(review);

        refreshProductReviewMetrics(product);
        auditLogService.log(
            currentUser,
            "REVIEW_CREATED",
            Map.of("entityName", "REVIEW", "entityId", review.getId(), "productId", product.getId())
        );
        return toDto(review, List.of());
    }

    public ApiPageResponse<ReviewDto> listReviews(UUID productId, Integer page, Integer size, String sort) {
        if (productId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "productId is required");
        }

        Pageable pageable = buildPageable(page, size, sort);
        var reviewPage = reviewRepository.findByProductIdAndActiveTrue(productId, pageable);
        List<ReviewDto> items = reviewPage.getContent().stream()
            .map(review -> toDto(review, reviewResponseRepository.findByReviewIdAndActiveTrueOrderByCreatedAtAsc(review.getId())))
            .toList();
        return new ApiPageResponse<>(items, reviewPage.getNumber(), reviewPage.getSize(), reviewPage.getTotalElements(), reviewPage.getTotalPages());
    }

    public ReviewDto getReview(UUID reviewId) {
        Review review = reviewRepository.findByIdAndActiveTrue(reviewId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
        return toDto(review, reviewResponseRepository.findByReviewIdAndActiveTrueOrderByCreatedAtAsc(reviewId));
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public ReviewDto updateReview(UUID reviewId, UpdateReviewRequest request) {
        var currentUser = currentUserService.requireCurrentAppUser();
        Review review = reviewRepository.findByIdAndUserIdAndActiveTrue(reviewId, currentUser.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        review.setStarRating(request.starRating());
        review.setReviewTitle(request.reviewTitle().trim());
        review.setReviewText(request.reviewText().trim());
        review.setReviewImages(request.reviewImages());

        boolean responseInvalidated = deactivateActiveResponses(review);
        refreshProductReviewMetrics(review.getProduct());

        auditLogService.log(
            currentUser,
            "REVIEW_UPDATED",
            Map.of(
                "entityName", "REVIEW",
                "entityId", review.getId(),
                "productId", review.getProduct().getId(),
                "responseInvalidated", responseInvalidated
            )
        );
        if (responseInvalidated) {
            notifyStoreOwnerAboutReviewChange(
                review,
                "Review updated",
                "A customer updated a review. The previous seller response was archived and you can publish a new one."
            );
        }
        return toDto(review, reviewResponseRepository.findByReviewIdAndActiveTrueOrderByCreatedAtAsc(reviewId));
    }

    @Transactional
    @PreAuthorize("hasRole('INDIVIDUAL')")
    public void deleteReview(UUID reviewId) {
        var currentUser = currentUserService.requireCurrentAppUser();
        Review review = reviewRepository.findByIdAndUserIdAndActiveTrue(reviewId, currentUser.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        boolean responseInvalidated = deactivateActiveResponses(review);
        review.setActive(false);
        refreshProductReviewMetrics(review.getProduct());

        auditLogService.log(
            currentUser,
            "REVIEW_DELETED",
            Map.of(
                "entityName", "REVIEW",
                "entityId", review.getId(),
                "productId", review.getProduct().getId(),
                "responseInvalidated", responseInvalidated
            )
        );
        notifyStoreOwnerAboutReviewChange(
            review,
            "Review removed",
            "A customer removed a review. Any previous seller response was archived."
        );
    }

    @Transactional
    @PreAuthorize("hasRole('CORPORATE')")
    public ReviewResponseDto createReviewResponse(UUID reviewId, CreateReviewResponseRequest request) {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        if (authenticatedUser.getActiveRole() != RoleType.CORPORATE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only corporate users can respond to reviews");
        }

        Review review = reviewRepository.findByIdAndActiveTrue(reviewId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
        if (!review.getProduct().getStore().getOwner().getId().equals(authenticatedUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only respond to reviews for your own store");
        }
        if (reviewResponseRepository.existsByReviewIdAndActiveTrue(reviewId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This review already has an active seller response");
        }

        var responder = currentUserService.requireCurrentAppUser();
        ReviewResponse response = new ReviewResponse();
        response.setId(UUID.randomUUID());
        response.setReview(review);
        response.setResponderUser(responder);
        response.setResponseText(request.responseText().trim());
        response.setActive(true);
        reviewResponseRepository.save(response);
        auditLogService.log(
            responder,
            "REVIEW_RESPONSE_CREATED",
            Map.of("entityName", "REVIEW_RESPONSE", "entityId", response.getId(), "reviewId", review.getId(), "productId", review.getProduct().getId())
        );
        return toResponseDto(response);
    }

    private Pageable buildPageable(Integer page, Integer size, String sortExpression) {
        int resolvedPage = page == null ? DEFAULT_PAGE : Math.max(page, 0);
        int resolvedSize = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        String requestedSort = sortExpression == null || sortExpression.isBlank() ? "createdAt,desc" : sortExpression;
        String[] parts = requestedSort.split(",", 2);
        String property = switch (parts[0].trim()) {
            case "starRating" -> "starRating";
            default -> "createdAt";
        };
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.ASC
            : Sort.Direction.DESC;
        return PageRequest.of(resolvedPage, resolvedSize, Sort.by(direction, property));
    }

    private void refreshProductReviewMetrics(Product product) {
        var stats = reviewRepository.calculateStatsByProductId(product.getId());
        long reviewCount = stats == null ? 0 : stats.getReviewCount();
        Double averageRating = stats == null ? null : stats.getAverageRating();
        product.setReviewCount(Math.toIntExact(reviewCount));
        BigDecimal roundedAverage = averageRating == null
            ? BigDecimal.ZERO
            : BigDecimal.valueOf(averageRating).setScale(2, RoundingMode.HALF_UP);
        product.setAvgRating(reviewCount == 0 ? null : roundedAverage);
    }

    private boolean deactivateActiveResponses(Review review) {
        List<ReviewResponse> activeResponses = reviewResponseRepository.findByReviewIdAndActiveTrue(review.getId());
        if (activeResponses.isEmpty()) {
            return false;
        }

        activeResponses.forEach(response -> response.setActive(false));
        auditLogService.log(
            "REVIEW_RESPONSE_ARCHIVED",
            Map.of("entityName", "REVIEW_RESPONSE", "reviewId", review.getId(), "productId", review.getProduct().getId())
        );
        return true;
    }

    private void notifyStoreOwnerAboutReviewChange(Review review, String title, String message) {
        notificationService.createNotification(review.getProduct().getStore().getOwner(), REVIEW_NOTIFICATION_TYPE, title, message);
    }

    private ReviewDto toDto(Review review, List<ReviewResponse> responses) {
        return new ReviewDto(
            review.getId(),
            review.getUser() != null ? review.getUser().getId() : null,
            review.getUser() != null ? review.getUser().getEmail() : null,
            review.getProduct().getId(),
            review.getOrder() != null ? review.getOrder().getId() : null,
            review.getStarRating(),
            review.getReviewTitle(),
            review.getReviewText(),
            review.getReviewImages(),
            review.isVerifiedPurchase(),
            review.getCreatedAt(),
            review.getUpdatedAt(),
            responses.stream().map(this::toResponseDto).toList()
        );
    }

    private ReviewResponseDto toResponseDto(ReviewResponse response) {
        return new ReviewResponseDto(
            response.getId(),
            response.getResponderUser().getId(),
            response.getResponderUser().getEmail(),
            response.getResponseText(),
            response.getCreatedAt()
        );
    }
}
