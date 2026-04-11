package com.project.ecommerce.category.repository;

import com.project.ecommerce.category.domain.Category;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();

    Optional<Category> findByIdAndActiveTrue(UUID id);
}
