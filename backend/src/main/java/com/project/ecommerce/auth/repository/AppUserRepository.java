package com.project.ecommerce.auth.repository;

import com.project.ecommerce.auth.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    boolean existsByEmailIgnoreCase(String email);

    java.util.List<AppUser> findAllByOrderByEmailAsc();

    Optional<AppUser> findByEmailIgnoreCase(String email);
}
