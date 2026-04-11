package com.project.ecommerce.category.service;

import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.category.domain.Category;
import com.project.ecommerce.category.dto.CategoryResponse;
import com.project.ecommerce.category.dto.CreateCategoryRequest;
import com.project.ecommerce.category.dto.UpdateCategoryRequest;
import com.project.ecommerce.category.repository.CategoryRepository;
import com.project.ecommerce.common.api.ApiListResponse;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public CategoryService(
        CategoryRepository categoryRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.categoryRepository = categoryRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    public ApiListResponse<CategoryResponse> listActiveCategories() {
        var categories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc().stream()
            .map(this::toResponse)
            .toList();
        return new ApiListResponse<>(categories, categories.size());
    }

    public CategoryResponse getActiveCategory(UUID categoryId) {
        var category = categoryRepository.findByIdAndActiveTrue(categoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        return toResponse(category);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponse createCategory(CreateCategoryRequest request) {
        Category parent = null;
        int level = 0;
        if (request.parentId() != null) {
            parent = categoryRepository.findByIdAndActiveTrue(request.parentId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parent category not found"));
            level = parent.getLevel() + 1;
        }

        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setName(request.name().trim());
        category.setSlug(generateUniqueSlug(request.name().trim(), null));
        category.setDescription(normalize(request.description()));
        category.setDisplayOrder(request.displayOrder() == null ? 0 : request.displayOrder());
        category.setParent(parent);
        category.setLevel(level);
        category.setActive(Boolean.TRUE.equals(request.active()));
        categoryRepository.save(category);

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "CATEGORY_CREATED",
            Map.of("entityName", "CATEGORY", "entityId", category.getId(), "categoryName", category.getName())
        );
        return toResponse(category);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponse updateCategory(UUID categoryId, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        if (request.name() != null && !request.name().isBlank()) {
            String normalizedName = request.name().trim();
            category.setName(normalizedName);
            category.setSlug(generateUniqueSlug(normalizedName, category.getId()));
        }
        if (request.description() != null) {
            category.setDescription(normalize(request.description()));
        }
        if (request.displayOrder() != null) {
            category.setDisplayOrder(request.displayOrder());
        }
        if (request.active() != null) {
            category.setActive(request.active());
        }

        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "CATEGORY_UPDATED",
            Map.of("entityName", "CATEGORY", "entityId", category.getId(), "categoryName", category.getName(), "active", category.isActive())
        );
        return toResponse(category);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void softDeleteCategory(UUID categoryId) {
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        if (!category.isActive()) {
            return;
        }

        category.setActive(false);
        auditLogService.log(
            currentUserService.requireCurrentAppUser(),
            "CATEGORY_UPDATED",
            Map.of("entityName", "CATEGORY", "entityId", category.getId(), "categoryName", category.getName(), "active", false)
        );
    }

    private CategoryResponse toResponse(Category category) {
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

    private String generateUniqueSlug(String name, UUID existingCategoryId) {
        String baseSlug = slugify(name);
        String candidate = baseSlug;
        int suffix = 2;
        while (slugExists(candidate, existingCategoryId)) {
            candidate = baseSlug + "-" + suffix;
            suffix++;
        }
        return candidate;
    }

    private boolean slugExists(String slug, UUID existingCategoryId) {
        if (existingCategoryId == null) {
            return categoryRepository.existsBySlug(slug);
        }
        return categoryRepository.existsBySlugAndIdNot(slug, existingCategoryId);
    }

    private String slugify(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? "category" : normalized;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
