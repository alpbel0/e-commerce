package com.project.ecommerce.store.repository;

import com.project.ecommerce.store.domain.Store;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoreRepository extends JpaRepository<Store, UUID> {

    @EntityGraph(attributePaths = {"owner"})
    List<Store> findByOwnerId(UUID ownerId);

    @Override
    @EntityGraph(attributePaths = {"owner"})
    Page<Store> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"owner"})
    Page<Store> findAllByStatusOrderByNameAsc(String status, Pageable pageable);

    @EntityGraph(attributePaths = {"owner"})
    Optional<Store> findByIdAndOwnerId(UUID id, UUID ownerId);

    @Override
    @EntityGraph(attributePaths = {"owner"})
    Optional<Store> findById(UUID id);

    @EntityGraph(attributePaths = {"owner"})
    Optional<Store> findByNameIgnoreCase(String name);
}
