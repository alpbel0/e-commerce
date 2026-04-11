package com.project.ecommerce.category.service;

import com.project.ecommerce.category.dto.CategoryResponse;
import com.project.ecommerce.category.repository.CategoryRepository;
import com.project.ecommerce.common.api.ApiListResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public ApiListResponse<CategoryResponse> listActiveCategories() {
        var categories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc().stream()
            .map(category -> new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                category.getParent() != null ? category.getParent().getId() : null,
                category.getLevel(),
                category.isActive(),
                category.getDisplayOrder()
            ))
            .toList();
        return new ApiListResponse<>(categories, categories.size());
    }

    public CategoryResponse getActiveCategory(UUID categoryId) {
        var category = categoryRepository.findByIdAndActiveTrue(categoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getSlug(),
            category.getDescription(),
            category.getParent() != null ? category.getParent().getId() : null,
            category.getLevel(),
            category.isActive(),
            category.getDisplayOrder()
        );
    }
}
