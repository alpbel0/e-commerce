package com.project.ecommerce.wishlist.web;

import com.project.ecommerce.wishlist.dto.AddToWishlistRequest;
import com.project.ecommerce.wishlist.dto.UpdateWishlistQuantityRequest;
import com.project.ecommerce.wishlist.dto.WishlistItemResponse;
import com.project.ecommerce.wishlist.service.WishlistService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {

    private final WishlistService wishlistService;

    public WishlistController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping
    public List<WishlistItemResponse> listWishlist() {
        return wishlistService.listWishlist();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistItemResponse addToWishlist(@Valid @RequestBody AddToWishlistRequest request) {
        return wishlistService.addToWishlist(request);
    }

    @PatchMapping("/{productId}")
    public WishlistItemResponse updateQuantity(
        @PathVariable UUID productId,
        @Valid @RequestBody UpdateWishlistQuantityRequest request
    ) {
        return wishlistService.updateQuantity(productId, request.quantity());
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeFromWishlist(@PathVariable UUID productId) {
        wishlistService.removeFromWishlist(productId);
    }
}
