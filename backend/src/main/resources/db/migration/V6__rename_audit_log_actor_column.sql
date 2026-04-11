ALTER TABLE audit_logs
    RENAME COLUMN admin_id TO actor_user_id;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id
    ON audit_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
    ON audit_logs(action, created_at DESC);
