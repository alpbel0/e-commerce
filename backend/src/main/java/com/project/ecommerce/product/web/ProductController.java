package com.project.ecommerce.product.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.product.dto.AddProductImagesRequest;
import com.project.ecommerce.product.dto.PatchProductRequest;
import com.project.ecommerce.product.dto.CreateProductRequest;
import com.project.ecommerce.product.dto.ProductDetailResponse;
import com.project.ecommerce.product.dto.ProductSummaryResponse;
import com.project.ecommerce.product.dto.UpdateProductRequest;
import com.project.ecommerce.product.dto.UpdateProductStockRequest;
import com.project.ecommerce.product.service.ProductService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ApiPageResponse<ProductSummaryResponse> listProducts(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) UUID categoryId,
        @RequestParam(required = false) UUID storeId,
        @RequestParam(required = false, name = "q") String query,
        @RequestParam(required = false) Boolean active
    ) {
        return productService.listProducts(page, size, sort, categoryId, storeId, query, active);
    }

    @GetMapping("/featured")
    public List<ProductSummaryResponse> getFeaturedProducts(@RequestParam(required = false) Integer limit) {
        return productService.getFeaturedProducts(limit);
    }

    @GetMapping("/{productId}")
    public ProductDetailResponse getProduct(@PathVariable UUID productId) {
        return productService.getProduct(productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDetailResponse createProduct(@Valid @RequestBody CreateProductRequest request) {
        return productService.createProduct(request);
    }

    @PutMapping("/{productId}")
    public ProductDetailResponse updateProduct(
        @PathVariable UUID productId,
        @Valid @RequestBody UpdateProductRequest request
    ) {
        return productService.updateProduct(productId, request);
    }

    @PatchMapping("/{productId}")
    public ProductDetailResponse patchProduct(
        @PathVariable UUID productId,
        @Valid @RequestBody PatchProductRequest request
    ) {
        return productService.patchProduct(productId, request);
    }

    @PatchMapping("/{productId}/stock")
    public ProductDetailResponse updateProductStock(
        @PathVariable UUID productId,
        @Valid @RequestBody UpdateProductStockRequest request
    ) {
        return productService.updateProductStock(productId, request);
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@PathVariable UUID productId) {
        productService.softDeleteProduct(productId);
    }

    @PostMapping("/{productId}/images")
    public ProductDetailResponse addProductImages(
        @PathVariable UUID productId,
        @Valid @RequestBody AddProductImagesRequest request
    ) {
        return productService.addProductImages(productId, request);
    }
}
