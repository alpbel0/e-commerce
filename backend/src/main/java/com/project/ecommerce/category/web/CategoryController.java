package com.project.ecommerce.category.web;

import com.project.ecommerce.category.dto.CategoryResponse;
import com.project.ecommerce.category.service.CategoryService;
import com.project.ecommerce.common.api.ApiListResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ApiListResponse<CategoryResponse> listCategories() {
        return categoryService.listActiveCategories();
    }

    @GetMapping("/{categoryId}")
    public CategoryResponse getCategory(@PathVariable UUID categoryId) {
        return categoryService.getActiveCategory(categoryId);
    }
}
