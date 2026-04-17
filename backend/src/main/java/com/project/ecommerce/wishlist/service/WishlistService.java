package com.project.ecommerce.wishlist.service;

import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.wishlist.domain.Wishlist;
import com.project.ecommerce.wishlist.dto.AddToWishlistRequest;
import com.project.ecommerce.wishlist.dto.WishlistItemResponse;
import com.project.ecommerce.wishlist.repository.WishlistRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final ProductRepository productRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public WishlistService(
        WishlistRepository wishlistRepository,
        ProductRepository productRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.wishlistRepository = wishlistRepository;
        this.productRepository = productRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    @Transactional(readOnly = true)
    public List<WishlistItemResponse> listWishlist() {
        UUID userId = currentUserService.requireAuthenticatedUser().getUserId();
        return wishlistRepository.findByUserId(userId).stream()
            .map(w -> toItemResponse(w))
            .toList();
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    @Transactional
    public WishlistItemResponse addToWishlist(AddToWishlistRequest request) {
        UUID userId = currentUserService.requireAuthenticatedUser().getUserId();
        UUID productId = request.productId();

        if (wishlistRepository.existsByUserIdAndProductId(userId, productId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Product already in wishlist");
        }

        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }
        if (!"OPEN".equals(product.getStore().getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }

        Wishlist wishlist = new Wishlist();
        wishlist.setId(UUID.randomUUID());
        wishlist.setUser(currentUserService.requireCurrentAppUser());
        wishlist.setProduct(product);
        wishlist.setQuantity(request.quantity() != null ? request.quantity() : 1);
        wishlistRepository.save(wishlist);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "WISHLIST_ADDED",
            Map.of("productId", productId, "quantity", wishlist.getQuantity())
        );

        return toItemResponse(wishlist);
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    @Transactional
    public void removeFromWishlist(UUID productId) {
        UUID userId = currentUserService.requireAuthenticatedUser().getUserId();

        if (!wishlistRepository.existsByUserIdAndProductId(userId, productId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not in wishlist");
        }

        wishlistRepository.deleteByUserIdAndProductId(userId, productId);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "WISHLIST_REMOVED",
            Map.of("productId", productId)
        );
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    @Transactional
    public WishlistItemResponse updateQuantity(UUID productId, int quantity) {
        UUID userId = currentUserService.requireAuthenticatedUser().getUserId();

        Wishlist wishlist = wishlistRepository.findByUserIdAndProductId(userId, productId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not in wishlist"));

        wishlist.setQuantity(quantity);
        wishlistRepository.save(wishlist);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "WISHLIST_QUANTITY_UPDATED",
            Map.of("productId", productId, "quantity", quantity)
        );

        return toItemResponse(wishlist);
    }

    private WishlistItemResponse toItemResponse(Wishlist wishlist) {
        Product product = wishlist.getProduct();
        return new WishlistItemResponse(
            product.getId(),
            product.getTitle(),
            product.getImageUrls().isEmpty() ? null : product.getImageUrls().getFirst(),
            product.getCurrency(),
            product.getUnitPrice(),
            wishlist.getQuantity(),
            product.getStore().getName(),
            product.getCategory().getName(),
            product.getDiscountPercentage() != null ? product.getDiscountPercentage().toPlainString() : "0",
            product.getAvgRating(),
            product.getReviewCount() != null ? product.getReviewCount() : 0,
            product.isActive()
        );
    }
}
