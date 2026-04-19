package com.project.ecommerce.chatbot.repository;

import com.project.ecommerce.chatbot.domain.QueryAuditLog;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface QueryAuditLogRepository extends JpaRepository<QueryAuditLog, UUID> {
}
