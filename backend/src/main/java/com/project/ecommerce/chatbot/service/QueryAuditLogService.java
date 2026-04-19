package com.project.ecommerce.chatbot.service;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.chatbot.domain.QueryAuditLog;
import com.project.ecommerce.chatbot.repository.QueryAuditLogRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QueryAuditLogService {

    private static final Logger log = LoggerFactory.getLogger(QueryAuditLogService.class);

    private final QueryAuditLogRepository repository;

    public QueryAuditLogService(QueryAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(
        UUID requestId,
        UUID userId,
        RoleType role,
        String sqlHash,
        String sqlSummary,
        String status,
        String rejectionReason,
        Integer rowCount,
        Long executionMs
    ) {
        QueryAuditLog auditLog = QueryAuditLog.builder()
            .requestId(requestId)
            .userId(userId)
            .role(role)
            .sqlHash(sqlHash)
            .sqlSummary(sqlSummary)
            .status(status)
            .rejectionReason(rejectionReason)
            .rowCount(rowCount)
            .executionMs(executionMs)
            .build();

        repository.save(auditLog);

        log.debug("Audit log saved: requestId={}, status={}, rowCount={}",
            requestId, status, rowCount);
    }
}
