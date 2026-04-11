package com.project.ecommerce.product.service;

import com.project.ecommerce.product.domain.Product;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class ProductSpecifications {

    private ProductSpecifications() {
    }

    public static Specification<Product> hasCategoryId(UUID categoryId) {
        return (root, query, criteriaBuilder) ->
            categoryId == null ? null : criteriaBuilder.equal(root.get("category").get("id"), categoryId);
    }

    public static Specification<Product> hasStoreId(UUID storeId) {
        return (root, query, criteriaBuilder) ->
            storeId == null ? null : criteriaBuilder.equal(root.get("store").get("id"), storeId);
    }

    public static Specification<Product> titleContains(String queryText) {
        return (root, query, criteriaBuilder) -> {
            if (queryText == null || queryText.isBlank()) {
                return null;
            }
            return criteriaBuilder.like(
                criteriaBuilder.lower(root.get("title")),
                "%" + queryText.trim().toLowerCase() + "%"
            );
        };
    }

    public static Specification<Product> hasActiveState(Boolean active) {
        return (root, query, criteriaBuilder) ->
            active == null ? null : criteriaBuilder.equal(root.get("active"), active);
    }
}
