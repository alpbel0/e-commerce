CREATE TABLE query_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'CORPORATE', 'INDIVIDUAL')),
    sql_hash VARCHAR(64),
    sql_summary VARCHAR(500),
    status VARCHAR(50) NOT NULL,
    rejection_reason VARCHAR(500),
    row_count INT,
    execution_ms BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_audit_logs_request_id ON query_audit_logs(request_id);
CREATE INDEX idx_query_audit_logs_user_id ON query_audit_logs(user_id);
CREATE INDEX idx_query_audit_logs_created_at ON query_audit_logs(created_at);
