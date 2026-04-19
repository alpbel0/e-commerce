package com.project.ecommerce.auth.repository;

import com.project.ecommerce.auth.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    boolean existsByEmailIgnoreCase(String email);

    java.util.List<AppUser> findAllByOrderByEmailAsc();

    Optional<AppUser> findByEmailIgnoreCase(String email);

    long countByActiveTrue();

    @Query("SELECT u FROM AppUser u WHERE " +
           "(:q IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<AppUser> searchUsers(@Param("q") String q, Pageable pageable);

    /**
     * Admin user list: filters match {@code resolveActiveRole} — highest-privilege active role wins;
     * users with no active role row are treated as INDIVIDUAL.
     */
    @Query(
        """
            SELECT u FROM AppUser u
            WHERE (:qPattern IS NULL
                OR LOWER(u.email) LIKE :qPattern
                OR (u.firstName IS NOT NULL AND LOWER(u.firstName) LIKE :qPattern)
                OR (u.lastName IS NOT NULL AND LOWER(u.lastName) LIKE :qPattern))
            AND (:active IS NULL OR u.active = :active)
            AND (
                :roleFilter IS NULL
                OR (
                    :roleFilter = 'ADMIN' AND EXISTS (
                        SELECT 1 FROM UserRole ur
                        WHERE ur.user.id = u.id AND ur.activeRole = true AND ur.roleType = com.project.ecommerce.auth.domain.RoleType.ADMIN
                    )
                )
                OR (
                    :roleFilter = 'CORPORATE' AND EXISTS (
                        SELECT 1 FROM UserRole ur
                        WHERE ur.user.id = u.id AND ur.activeRole = true AND ur.roleType = com.project.ecommerce.auth.domain.RoleType.CORPORATE
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM UserRole ur
                        WHERE ur.user.id = u.id AND ur.activeRole = true AND ur.roleType = com.project.ecommerce.auth.domain.RoleType.ADMIN
                    )
                )
                OR (
                    :roleFilter = 'INDIVIDUAL' AND NOT EXISTS (
                        SELECT 1 FROM UserRole ur
                        WHERE ur.user.id = u.id AND ur.activeRole = true AND ur.roleType IN (com.project.ecommerce.auth.domain.RoleType.ADMIN, com.project.ecommerce.auth.domain.RoleType.CORPORATE)
                    )
                )
            )
            ORDER BY u.email ASC
            """
    )
    Page<AppUser> findForAdminList(
        @Param("qPattern") String qPattern,
        @Param("active") Boolean active,
        @Param("roleFilter") String roleFilter,
        Pageable pageable
    );
}
