package com.project.ecommerce.category.repository;

import com.project.ecommerce.category.domain.Category;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();

    Optional<Category> findByIdAndActiveTrue(UUID id);

    boolean existsBySlug(String slug);

    @Query("select count(c) > 0 from Category c where c.slug = :slug and c.id <> :excludedId")
    boolean existsBySlugAndIdNot(String slug, UUID excludedId);
}
