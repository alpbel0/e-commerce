package com.project.ecommerce.auditlog.web;

import com.project.ecommerce.auditlog.dto.AuditLogResponse;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.common.api.ApiPageResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/audit-logs", "/api/admin/audit-logs"})
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ApiPageResponse<AuditLogResponse> listAuditLogs(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String action
    ) {
        return auditLogService.listAuditLogs(page, size, action);
    }

    @GetMapping("/{auditLogId}")
    public AuditLogResponse getAuditLog(@PathVariable UUID auditLogId) {
        return auditLogService.getAuditLog(auditLogId);
    }
}
