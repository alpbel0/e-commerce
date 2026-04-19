package com.project.ecommerce.chatbot.domain;

import com.project.ecommerce.auth.domain.RoleType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "query_audit_logs")
public class QueryAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private RoleType role;

    @Column(name = "sql_hash", length = 64)
    private String sqlHash;

    @Column(name = "sql_summary", length = 500)
    private String sqlSummary;

    @Column(name = "status", nullable = false, length = 50)
    private String status;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "row_count")
    private Integer rowCount;

    @Column(name = "execution_ms")
    private Long executionMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public QueryAuditLog() {
    }

    private QueryAuditLog(Builder builder) {
        this.requestId = builder.requestId;
        this.userId = builder.userId;
        this.role = builder.role;
        this.sqlHash = builder.sqlHash;
        this.sqlSummary = builder.sqlSummary;
        this.status = builder.status;
        this.rejectionReason = builder.rejectionReason;
        this.rowCount = builder.rowCount;
        this.executionMs = builder.executionMs;
        this.createdAt = Instant.now();
    }

    public static Builder builder() {
        return new Builder();
    }

    public UUID getId() {
        return id;
    }

    public UUID getRequestId() {
        return requestId;
    }

    public UUID getUserId() {
        return userId;
    }

    public RoleType getRole() {
        return role;
    }

    public String getSqlHash() {
        return sqlHash;
    }

    public String getSqlSummary() {
        return sqlSummary;
    }

    public String getStatus() {
        return status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public Integer getRowCount() {
        return rowCount;
    }

    public Long getExecutionMs() {
        return executionMs;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public static class Builder {
        private UUID requestId;
        private UUID userId;
        private RoleType role;
        private String sqlHash;
        private String sqlSummary;
        private String status;
        private String rejectionReason;
        private Integer rowCount;
        private Long executionMs;

        public Builder requestId(UUID requestId) {
            this.requestId = requestId;
            return this;
        }

        public Builder userId(UUID userId) {
            this.userId = userId;
            return this;
        }

        public Builder role(RoleType role) {
            this.role = role;
            return this;
        }

        public Builder sqlHash(String sqlHash) {
            this.sqlHash = sqlHash;
            return this;
        }

        public Builder sqlSummary(String sqlSummary) {
            this.sqlSummary = sqlSummary;
            return this;
        }

        public Builder status(String status) {
            this.status = status;
            return this;
        }

        public Builder rejectionReason(String rejectionReason) {
            this.rejectionReason = rejectionReason;
            return this;
        }

        public Builder rowCount(Integer rowCount) {
            this.rowCount = rowCount;
            return this;
        }

        public Builder executionMs(Long executionMs) {
            this.executionMs = executionMs;
            return this;
        }

        public QueryAuditLog build() {
            return new QueryAuditLog(this);
        }
    }
}
