package com.project.ecommerce.auth.repository;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    List<UserRole> findByUserId(UUID userId);

    Optional<UserRole> findByUserIdAndActiveRoleTrue(UUID userId);

    List<UserRole> findAllByUserIdAndActiveRoleTrue(UUID userId);

    boolean existsByUserIdAndRoleType(UUID userId, RoleType roleType);
}
