package com.project.ecommerce.product.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.category.repository.CategoryRepository;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.product.dto.PatchProductRequest;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.dto.CreateProductRequest;
import com.project.ecommerce.product.dto.ProductDetailResponse;
import com.project.ecommerce.product.dto.ProductSummaryResponse;
import com.project.ecommerce.product.dto.UpdateProductRequest;
import com.project.ecommerce.product.dto.UpdateProductStockRequest;
import com.project.ecommerce.product.dto.AddProductImagesRequest;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final CategoryRepository categoryRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public ProductService(
        ProductRepository productRepository,
        StoreRepository storeRepository,
        CategoryRepository categoryRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.productRepository = productRepository;
        this.storeRepository = storeRepository;
        this.categoryRepository = categoryRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    public List<ProductSummaryResponse> getFeaturedProducts(Integer limit) {
        int resolvedLimit = limit == null ? 10 : Math.min(Math.max(limit, 1), 50);
        Pageable pageable = PageRequest.of(0, resolvedLimit);
        return productRepository.findFeaturedActiveProducts(pageable).stream()
            .map(this::toSummaryResponse)
            .toList();
    }

    public ApiPageResponse<ProductSummaryResponse> listProducts(
        Integer page,
        Integer size,
        String sort,
        UUID categoryId,
        UUID storeId,
        String query,
        Boolean active
    ) {
        Specification<Product> specification = Specification
            .where(ProductSpecifications.hasCategoryId(categoryId))
            .and(ProductSpecifications.hasStoreId(storeId))
            .and(ProductSpecifications.titleContains(query))
            .and(ProductSpecifications.hasActiveState(active == null ? Boolean.TRUE : active))
            .and(ProductSpecifications.hasOpenStore());

        Pageable pageable = buildPageable(page, size, sort, "createdAt");
        var resultPage = productRepository.findAll(specification, pageable);
        var items = resultPage.stream().map(this::toSummaryResponse).toList();
        return new ApiPageResponse<>(items, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    public ProductDetailResponse getProduct(UUID productId) {
        Product product = productRepository.findByIdAndActiveTrue(productId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (!"OPEN".equals(product.getStore().getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }
        return toDetailResponse(product);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public ProductDetailResponse createProduct(CreateProductRequest request) {
        if (productRepository.existsBySkuIgnoreCase(request.sku())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SKU already exists");
        }

        AuthenticatedUser currentUser = currentUserService.requireAuthenticatedUser();
        Store store = storeRepository.findById(request.storeId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));

        if (currentUser.getActiveRole() == RoleType.CORPORATE && !store.getOwner().getId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot manage products for another store");
        }

        var category = categoryRepository.findByIdAndActiveTrue(request.categoryId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found or inactive"));

        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setStore(store);
        product.setCategory(category);
        product.setSku(request.sku().trim());
        product.setTitle(request.title().trim());
        product.setDescription(request.description());
        product.setBrand(request.brand());
        product.setImageUrls(request.imageUrls());
        product.setCurrency(normalizeCurrency(request.currency(), "USD"));
        product.setSourceCountry(blankToNull(request.sourceCountry()));
        product.setUnitPrice(request.unitPrice());
        product.setDiscountPercentage(request.discountPercentage());
        product.setCostOfProduct(request.costOfProduct());
        product.setStockQuantity(request.stockQuantity());
        product.setTags(request.tags());
        product.setReviewCount(0);
        product.setTotalSales(0);
        product.setActive(true);
        productRepository.save(product);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "PRODUCT_CREATED",
            java.util.Map.of(
                "productId", product.getId(),
                "storeId", store.getId(),
                "sku", product.getSku()
            )
        );
        return toDetailResponse(product);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public void softDeleteProduct(UUID productId) {
        Product product = requireManageableActiveProduct(productId);

        product.setActive(false);
        productRepository.save(product);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "PRODUCT_DELETED",
            java.util.Map.of("productId", product.getId(), "sku", product.getSku())
        );
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public ProductDetailResponse updateProduct(UUID productId, UpdateProductRequest request) {
        Product product = requireManageableActiveProduct(productId);
        applyCategory(product, request.categoryId());
        product.setTitle(request.title().trim());
        product.setDescription(request.description());
        product.setBrand(request.brand());
        product.setImageUrls(request.imageUrls());
        product.setCurrency(normalizeCurrency(request.currency(), product.getCurrency()));
        product.setSourceCountry(blankToNull(request.sourceCountry()));
        product.setUnitPrice(request.unitPrice());
        product.setDiscountPercentage(request.discountPercentage());
        product.setCostOfProduct(request.costOfProduct());
        product.setStockQuantity(request.stockQuantity());
        product.setTags(request.tags());
        product.setActive(request.active() == null || request.active());
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "PRODUCT_UPDATED",
            java.util.Map.of("productId", product.getId(), "mode", "PUT")
        );
        return toDetailResponse(product);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public ProductDetailResponse patchProduct(UUID productId, PatchProductRequest request) {
        Product product = requireManageableActiveProduct(productId);

        if (request.categoryId() != null) {
            applyCategory(product, request.categoryId());
        }
        if (request.title() != null) {
            if (request.title().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title must not be blank");
            }
            product.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            product.setDescription(request.description());
        }
        if (request.brand() != null) {
            product.setBrand(request.brand());
        }
        if (request.imageUrls() != null) {
            product.setImageUrls(request.imageUrls());
        }
        if (request.currency() != null) {
            product.setCurrency(normalizeCurrency(request.currency(), product.getCurrency()));
        }
        if (request.sourceCountry() != null) {
            product.setSourceCountry(blankToNull(request.sourceCountry()));
        }
        if (request.unitPrice() != null) {
            product.setUnitPrice(request.unitPrice());
        }
        if (request.discountPercentage() != null) {
            product.setDiscountPercentage(request.discountPercentage());
        }
        if (request.costOfProduct() != null) {
            product.setCostOfProduct(request.costOfProduct());
        }
        if (request.stockQuantity() != null) {
            product.setStockQuantity(request.stockQuantity());
        }
        if (request.tags() != null) {
            product.setTags(request.tags());
        }
        if (request.active() != null) {
            product.setActive(request.active());
        }
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "PRODUCT_UPDATED",
            java.util.Map.of("productId", product.getId(), "mode", "PATCH")
        );
        return toDetailResponse(product);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public ProductDetailResponse updateProductStock(UUID productId, UpdateProductStockRequest request) {
        Product product = requireManageableActiveProduct(productId);
        product.setStockQuantity(request.stockQuantity());
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "PRODUCT_STOCK_UPDATED",
            java.util.Map.of("productId", product.getId(), "stockQuantity", request.stockQuantity())
        );
        return toDetailResponse(product);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('CORPORATE', 'ADMIN')")
    public ProductDetailResponse addProductImages(UUID productId, AddProductImagesRequest request) {
        Product product = requireManageableActiveProduct(productId);

        List<String> existingImages = new ArrayList<>(product.getImageUrls());
        for (String url : request.imageUrls()) {
            if (url != null && !url.isBlank() && !existingImages.contains(url.trim())) {
                existingImages.add(url.trim());
            }
        }
        product.setImageUrls(existingImages);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "PRODUCT_IMAGES_ADDED",
            java.util.Map.of(
                "productId", product.getId(),
                "addedCount", request.imageUrls().size()
            )
        );
        return toDetailResponse(product);
    }

    private Pageable buildPageable(Integer page, Integer size, String sortExpression, String defaultSortField) {
        int resolvedPage = page == null ? DEFAULT_PAGE : Math.max(page, 0);
        int resolvedSize = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        Sort sort = parseSort(sortExpression, defaultSortField);
        return PageRequest.of(resolvedPage, resolvedSize, sort);
    }

    private Sort parseSort(String sortExpression, String defaultSortField) {
        if (sortExpression == null || sortExpression.isBlank()) {
            return Sort.by(Sort.Direction.DESC, defaultSortField);
        }

        String[] parts = sortExpression.split(",", 2);
        String property = switch (parts[0].trim()) {
            case "title" -> "title";
            case "unitPrice", "price" -> "unitPrice";
            case "stockQuantity", "stock" -> "stockQuantity";
            case "createdAt" -> "createdAt";
            default -> defaultSortField;
        };
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.ASC
            : Sort.Direction.DESC;
        return Sort.by(direction, property);
    }

    private Product requireManageableActiveProduct(UUID productId) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (!product.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }

        AuthenticatedUser currentUser = currentUserService.requireAuthenticatedUser();
        if (currentUser.getActiveRole() == RoleType.CORPORATE
            && !product.getStore().getOwner().getId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot manage products for another store");
        }
        return product;
    }

    private void applyCategory(Product product, UUID categoryId) {
        var category = categoryRepository.findByIdAndActiveTrue(categoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found or inactive"));
        product.setCategory(category);
    }

    private ProductSummaryResponse toSummaryResponse(Product product) {
        return new ProductSummaryResponse(
            product.getId(),
            product.getSku(),
            product.getTitle(),
            product.getImageUrls().isEmpty() ? null : product.getImageUrls().getFirst(),
            product.getCurrency(),
            product.getSourceCountry(),
            product.getUnitPrice(),
            product.getDiscountPercentage(),
            product.getStockQuantity(),
            product.getAvgRating(),
            product.getReviewCount() == null ? 0 : product.getReviewCount(),
            product.isActive(),
            product.getStore().getId(),
            product.getStore().getName(),
            product.getCategory().getId(),
            product.getCategory().getName()
        );
    }

    private ProductDetailResponse toDetailResponse(Product product) {
        return new ProductDetailResponse(
            product.getId(),
            product.getSku(),
            product.getTitle(),
            product.getDescription(),
            product.getBrand(),
            product.getCurrency(),
            product.getSourceCountry(),
            product.getUnitPrice(),
            product.getDiscountPercentage(),
            product.getCostOfProduct(),
            product.getStockQuantity(),
            product.getAvgRating(),
            product.getReviewCount() == null ? 0 : product.getReviewCount(),
            product.getTotalSales() == null ? 0 : product.getTotalSales(),
            product.isActive(),
            product.getStore().getId(),
            product.getStore().getName(),
            product.getCategory().getId(),
            product.getCategory().getName(),
            product.getImageUrls(),
            product.getTags(),
            product.getCreatedAt(),
            product.getUpdatedAt()
        );
    }

    private String normalizeCurrency(String currency, String fallback) {
        if (currency == null || currency.isBlank()) {
            return fallback == null || fallback.isBlank() ? "USD" : fallback.trim().toUpperCase();
        }
        return currency.trim().toUpperCase();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
