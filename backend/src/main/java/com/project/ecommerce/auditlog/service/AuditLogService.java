package com.project.ecommerce.auditlog.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.ecommerce.auditlog.domain.AuditLog;
import com.project.ecommerce.auditlog.dto.AuditLogResponse;
import com.project.ecommerce.auditlog.repository.AuditLogRepository;
import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.common.api.ApiPageResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuditLogService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditLogService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void log(AppUser actorUser, String action, Map<String, Object> details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setId(UUID.randomUUID());
        auditLog.setActorUser(actorUser);
        auditLog.setAction(action);
        auditLog.setDetails(writeDetails(details));
        auditLogRepository.save(auditLog);
    }

    @Transactional
    public void log(String action, Map<String, Object> details) {
        log((AppUser) null, action, details);
    }

    @PreAuthorize("hasRole('ADMIN')")
    public ApiPageResponse<AuditLogResponse> listAuditLogs(Integer page, Integer size, String action) {
        Pageable pageable = PageRequest.of(
            page == null ? DEFAULT_PAGE : Math.max(page, 0),
            size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE),
            Sort.by(Sort.Direction.DESC, "createdAt")
        );
        var resultPage = action == null || action.isBlank()
            ? auditLogRepository.findAll(pageable)
            : auditLogRepository.findByActionOrderByCreatedAtDesc(action.trim().toUpperCase(), pageable);
        var items = resultPage.stream().map(this::toResponse).toList();
        return new ApiPageResponse<>(items, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    @PreAuthorize("hasRole('ADMIN')")
    public AuditLogResponse getAuditLog(UUID auditLogId) {
        AuditLog auditLog = auditLogRepository.findById(auditLogId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit log not found"));
        return toResponse(auditLog);
    }

    private AuditLogResponse toResponse(AuditLog auditLog) {
        return new AuditLogResponse(
            auditLog.getId(),
            auditLog.getActorUser() == null ? null : auditLog.getActorUser().getId(),
            auditLog.getActorUser() == null ? null : auditLog.getActorUser().getEmail(),
            auditLog.getAction(),
            auditLog.getDetails(),
            auditLog.getCreatedAt()
        );
    }

    private String writeDetails(Map<String, Object> details) {
        try {
            return objectMapper.writeValueAsString(details == null ? Map.of() : details);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize audit log details", exception);
        }
    }
}
