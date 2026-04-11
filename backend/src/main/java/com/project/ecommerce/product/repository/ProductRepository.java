package com.project.ecommerce.product.repository;

import com.project.ecommerce.product.domain.Product;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    boolean existsBySkuIgnoreCase(String sku);

    @Override
    @EntityGraph(attributePaths = {"store", "category"})
    Page<Product> findAll(Specification<Product> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"store", "category"})
    Optional<Product> findById(UUID id);

    @EntityGraph(attributePaths = {"store", "category"})
    Optional<Product> findByIdAndActiveTrue(UUID id);
}
