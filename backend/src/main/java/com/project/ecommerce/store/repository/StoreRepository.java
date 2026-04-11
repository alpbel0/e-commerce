package com.project.ecommerce.store.repository;

import com.project.ecommerce.store.domain.Store;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoreRepository extends JpaRepository<Store, UUID> {

    List<Store> findByOwnerId(UUID ownerId);
}
