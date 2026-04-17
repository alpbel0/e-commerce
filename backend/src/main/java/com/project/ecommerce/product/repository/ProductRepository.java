package com.project.ecommerce.product.repository;

import com.project.ecommerce.product.domain.Product;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    boolean existsBySkuIgnoreCase(String sku);

    @Override
    @EntityGraph(attributePaths = {"store", "category"})
    Page<Product> findAll(Specification<Product> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"store", "category"})
    Optional<Product> findById(UUID id);

    @EntityGraph(attributePaths = {"store", "category"})
    Optional<Product> findByIdAndActiveTrue(UUID id);

    @Modifying(flushAutomatically = true)
    @Query("""
        update Product p
        set p.stockQuantity = p.stockQuantity - :quantity
        where p.id = :productId
          and p.stockQuantity >= :quantity
    """)
    int decrementStockIfAvailable(UUID productId, int quantity);

    @Modifying(flushAutomatically = true)
    @Query("""
        update Product p
        set p.stockQuantity = p.stockQuantity + :quantity
        where p.id = :productId
    """)
    int incrementStock(UUID productId, int quantity);

    @EntityGraph(attributePaths = {"store", "category"})
    @Query("""
        select p from Product p
        where p.active = true
          and p.store.status = 'OPEN'
        order by p.avgRating desc nulls last
    """)
    List<Product> findFeaturedActiveProducts(Pageable pageable);
}
