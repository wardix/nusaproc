-- ============================================================================
-- Migration 004: System Feedback & Bug Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'BUG', -- 'BUG', 'FEATURE_REQUEST', 'FEEDBACK'
    urgency VARCHAR(32) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    title VARCHAR(255),
    description TEXT NOT NULL,
    page_url TEXT NOT NULL,
    active_role VARCHAR(32) NOT NULL,
    screenshot_data TEXT, -- Base64 PNG image or attachment URI
    system_info JSONB, -- browser, OS, screen size, user-agent
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_system_feedback_status ON system_feedback(status);
CREATE INDEX IF NOT EXISTS idx_system_feedback_category ON system_feedback(category);
CREATE INDEX IF NOT EXISTS idx_system_feedback_created_at ON system_feedback(created_at DESC);
