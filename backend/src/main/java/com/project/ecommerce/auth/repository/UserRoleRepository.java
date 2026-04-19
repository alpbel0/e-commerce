package com.project.ecommerce.auth.repository;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    List<UserRole> findByUserId(UUID userId);

    Optional<UserRole> findByUserIdAndActiveRoleTrue(UUID userId);

    List<UserRole> findAllByUserIdAndActiveRoleTrue(UUID userId);

    boolean existsByUserIdAndRoleType(UUID userId, RoleType roleType);

    @Query("""
        SELECT COUNT(ur)
        FROM UserRole ur
        WHERE ur.activeRole = true
          AND ur.roleType = com.project.ecommerce.auth.domain.RoleType.ADMIN
          AND ur.user.active = true
    """)
    long countActiveAdminUsers();

    @Query("""
        SELECT CASE WHEN COUNT(ur) > 0 THEN true ELSE false END
        FROM UserRole ur
        WHERE ur.user.id = :userId
          AND ur.roleType = :roleType
    """)
    boolean existsAnyByUserIdAndRoleType(@Param("userId") UUID userId, @Param("roleType") RoleType roleType);
}
