package com.project.ecommerce.auditlog.repository;

import com.project.ecommerce.auditlog.domain.AuditLog;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Override
    @EntityGraph(attributePaths = {"actorUser"})
    Optional<AuditLog> findById(UUID id);

    @Override
    @EntityGraph(attributePaths = {"actorUser"})
    Page<AuditLog> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"actorUser"})
    Page<AuditLog> findByActionOrderByCreatedAtDesc(String action, Pageable pageable);
}
