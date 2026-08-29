-- ============================================================================
-- NusaProc Migration 001: Initial PostgreSQL 16 DDL Schema, Extensions & Seed
-- Rujukan: TDD Bagian 5.2 | PRD Bagian 7 (R1–R65)
-- ============================================================================

-- 0. Extensions Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUM TYPE DEFINITIONS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE app_role_enum AS ENUM (
        'REQUESTER',
        'APPROVER',
        'ACCOUNT_PAYABLE',
        'WAREHOUSE',
        'FINANCE',
        'AUDITOR',
        'ADMIN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vendor_status_enum AS ENUM ('PROSPECTIVE', 'APPROVED', 'SUSPENDED', 'BLACKLISTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bank_account_status_enum AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_term_type_enum AS ENUM ('ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pr_status_enum AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED_PARTIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_decision_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE po_status_enum AS ENUM ('DRAFT', 'ISSUED', 'AMENDED', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE receipt_type_enum AS ENUM ('DIRECT_REQUESTER', 'WAREHOUSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type_enum AS ENUM ('STANDARD', 'ADVANCE_PAYMENT', 'PROGRESS_TERMIN', 'FINAL_SETTLEMENT', 'CREDIT_NOTE', 'DEBIT_NOTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status_enum AS ENUM ('UNMATCHED', 'MATCHED_OK', 'MATCHED_WITH_EXCEPTION', 'EXCEPTION_OVERRIDDEN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_proposal_status_enum AS ENUM ('PROPOSED', 'CHECKED', 'EXECUTED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. AUTHENTICATION, RBAC & DELEGATION DOMAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(64) NOT NULL UNIQUE,
    division_id VARCHAR(64) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_local_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    local_password_hash TEXT,
    totp_secret_encrypted TEXT,
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS user_role_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
    role app_role_enum NOT NULL,
    is_tax_specialist BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    assigned_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS approval_delegation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES app_user(id),
    delegatee_id UUID NOT NULL REFERENCES app_user(id),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    max_amount_limit NUMERIC(18, 2),
    scope_division_id VARCHAR(64),
    reason TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_delegation_users CHECK (delegator_id != delegatee_id),
    CONSTRAINT chk_delegation_dates CHECK (end_date > start_date)
);

-- ============================================================================
-- 3. VENDOR & TEMPORAL BANK ACCOUNT DOMAIN (R17, R18, R19)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    tax_identification_number VARCHAR(32) NOT NULL,
    is_pkp BOOLEAN NOT NULL DEFAULT FALSE,
    status vendor_status_enum NOT NULL DEFAULT 'PROSPECTIVE',
    created_by UUID NOT NULL REFERENCES app_user(id),
    approved_by_1 UUID REFERENCES app_user(id),
    approved_at_1 TIMESTAMPTZ,
    approved_by_2 UUID REFERENCES app_user(id),
    approved_at_2 TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_vendor_dual_approval CHECK (approved_by_1 IS NULL OR approved_by_2 IS NULL OR approved_by_1 != approved_by_2)
);

CREATE TABLE IF NOT EXISTS vendor_bank_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
    bank_name VARCHAR(128) NOT NULL,
    bank_code VARCHAR(32) NOT NULL,
    account_number_encrypted TEXT NOT NULL,
    account_number_masked VARCHAR(32) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    status bank_account_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by_1 UUID REFERENCES app_user(id),
    verified_at_1 TIMESTAMPTZ,
    verified_by_2 UUID REFERENCES app_user(id),
    verified_at_2 TIMESTAMPTZ,
    rejection_reason TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_bank_dual_verification CHECK (verified_by_1 IS NULL OR verified_by_2 IS NULL OR verified_by_1 != verified_by_2)
);

CREATE TABLE IF NOT EXISTS vendor_performance_rating (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor(id),
    po_id UUID NOT NULL,
    delivery_score INT NOT NULL CHECK (delivery_score BETWEEN 1 AND 5),
    quality_score INT NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
    service_score INT NOT NULL CHECK (service_score BETWEEN 1 AND 5),
    comments TEXT,
    rated_by UUID NOT NULL REFERENCES app_user(id),
    rated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 4. PURCHASE REQUEST (PR) & APPROVAL DOMAIN (R6–R16, R48)
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_number VARCHAR(64) NOT NULL UNIQUE,
    requester_id UUID NOT NULL REFERENCES app_user(id),
    cost_center VARCHAR(64) NOT NULL,
    division_id VARCHAR(64) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    required_date DATE NOT NULL,
    payment_term_type payment_term_type_enum NOT NULL,
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_justification TEXT,
    business_justification TEXT NOT NULL,
    status pr_status_enum NOT NULL DEFAULT 'DRAFT',
    total_estimated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    locked_approval_policy_version VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS purchase_request_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES purchase_request(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    specification TEXT,
    quantity_requested NUMERIC(12, 2) NOT NULL CHECK (quantity_requested > 0),
    quantity_ordered NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    uom VARCHAR(32) NOT NULL,
    estimated_unit_price NUMERIC(18, 2) NOT NULL CHECK (estimated_unit_price >= 0),
    subtotal NUMERIC(18, 2) GENERATED ALWAYS AS (quantity_requested * estimated_unit_price) STORED,
    CONSTRAINT uq_pr_item_line UNIQUE (pr_id, line_number)
);

CREATE TABLE IF NOT EXISTS approval_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES purchase_request(id) ON DELETE RESTRICT,
    step_order INT NOT NULL,
    assigned_role app_role_enum NOT NULL,
    assigned_user_id UUID REFERENCES app_user(id),
    required_min_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    decision approval_decision_enum NOT NULL DEFAULT 'PENDING',
    decision_by UUID REFERENCES app_user(id),
    decision_at TIMESTAMPTZ,
    rejection_reason TEXT,
    delegated_from_user_id UUID REFERENCES app_user(id),
    CONSTRAINT uq_approval_step UNIQUE (pr_id, step_order)
);

CREATE TABLE IF NOT EXISTS emergency_post_review (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES purchase_request(id),
    po_id UUID,
    review_due_date DATE NOT NULL,
    is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by UUID REFERENCES app_user(id),
    reviewed_at TIMESTAMPTZ,
    audit_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 5. PURCHASE ORDER (PO) & SOURCING DOMAIN (R20–R27)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_quotation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES purchase_request(id),
    vendor_id UUID NOT NULL REFERENCES vendor(id),
    quotation_reference VARCHAR(128) NOT NULL,
    total_quoted_amount NUMERIC(18, 2) NOT NULL,
    delivery_lead_time_days INT NOT NULL,
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    selection_justification TEXT,
    created_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS purchase_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(64) NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
    vendor_bank_account_id UUID NOT NULL REFERENCES vendor_bank_account(id) ON DELETE RESTRICT,
    payment_term_type payment_term_type_enum NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    status po_status_enum NOT NULL DEFAULT 'DRAFT',
    subtotal_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    grand_total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    terms_and_conditions TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES app_user(id),
    approved_by UUID REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_po_sod_ap CHECK (created_by != approved_by)
);

CREATE TABLE IF NOT EXISTS purchase_order_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    pr_item_id UUID NOT NULL REFERENCES purchase_request_item(id) ON DELETE RESTRICT,
    line_number INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity_ordered NUMERIC(12, 2) NOT NULL CHECK (quantity_ordered > 0),
    quantity_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    quantity_invoiced NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    uom VARCHAR(32) NOT NULL,
    unit_price NUMERIC(18, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(18, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
    CONSTRAINT uq_po_item_line UNIQUE (po_id, line_number)
);

CREATE TABLE IF NOT EXISTS po_amendment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_order(id),
    amendment_number INT NOT NULL,
    change_summary TEXT NOT NULL,
    previous_snapshot JSONB NOT NULL,
    requested_by UUID NOT NULL REFERENCES app_user(id),
    approved_by UUID NOT NULL REFERENCES app_user(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_po_amendment UNIQUE (po_id, amendment_number)
);

-- ============================================================================
-- 6. GOODS RECEIPT (BAST) & NCR DOMAIN (R28–R32)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goods_receipt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_number VARCHAR(64) NOT NULL UNIQUE,
    po_id UUID NOT NULL REFERENCES purchase_order(id) ON DELETE RESTRICT,
    receipt_type receipt_type_enum NOT NULL,
    delivery_note_number VARCHAR(128),
    received_date DATE NOT NULL,
    received_by UUID NOT NULL REFERENCES app_user(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS goods_receipt_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_id UUID NOT NULL REFERENCES goods_receipt(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES purchase_order_item(id) ON DELETE RESTRICT,
    quantity_received NUMERIC(12, 2) NOT NULL CHECK (quantity_received >= 0),
    quantity_rejected NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (quantity_rejected >= 0),
    condition_notes TEXT
);

CREATE TABLE IF NOT EXISTS non_conformance_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ncr_number VARCHAR(64) NOT NULL UNIQUE,
    gr_id UUID NOT NULL REFERENCES goods_receipt(id),
    po_id UUID NOT NULL REFERENCES purchase_order(id),
    description TEXT NOT NULL,
    action_required TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES app_user(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 7. INVOICE, TAX SNAPSHOT & 2-WAY MATCHING (R33–R40)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_rule_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ppn_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1200,
    dpp_factor NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
    pph_article VARCHAR(16),
    pph_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    tax_regulation_ref VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number_internal VARCHAR(64) NOT NULL UNIQUE,
    vendor_invoice_number VARCHAR(128) NOT NULL,
    vendor_invoice_normalized VARCHAR(128) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendor(id),
    po_id UUID NOT NULL REFERENCES purchase_order(id) ON DELETE RESTRICT,
    gr_id UUID REFERENCES goods_receipt(id),
    invoice_type invoice_type_enum NOT NULL DEFAULT 'STANDARD',
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal_amount NUMERIC(18, 2) NOT NULL,
    ppn_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    pph_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_payable_amount NUMERIC(18, 2) NOT NULL,
    nsfp_original VARCHAR(32),
    nsfp_normalized VARCHAR(32),
    is_nsfp_valid BOOLEAN NOT NULL DEFAULT FALSE,
    tax_snapshot_id UUID NOT NULL REFERENCES tax_rule_snapshot(id),
    match_status match_status_enum NOT NULL DEFAULT 'UNMATCHED',
    is_held_for_tax BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_vendor_invoice_duplicate UNIQUE (vendor_id, vendor_invoice_normalized, invoice_date, total_payable_amount)
);

CREATE TABLE IF NOT EXISTS invoice_matching_exception (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
    exception_code VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    variance_amount NUMERIC(18, 2),
    variance_percentage NUMERIC(6, 2),
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    override_reason TEXT,
    overridden_by UUID REFERENCES app_user(id),
    overridden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 8. PAYMENT & IDEMPOTENCY DOMAIN (R41–R47)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_proposal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_number VARCHAR(64) NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendor(id),
    vendor_bank_account_id UUID NOT NULL REFERENCES vendor_bank_account(id),
    total_payment_amount NUMERIC(18, 2) NOT NULL,
    payment_method VARCHAR(64) NOT NULL DEFAULT 'BANK_TRANSFER',
    status payment_proposal_status_enum NOT NULL DEFAULT 'PROPOSED',
    proposed_by UUID NOT NULL REFERENCES app_user(id),
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    checked_by UUID REFERENCES app_user(id),
    checked_at TIMESTAMPTZ,
    executed_by UUID REFERENCES app_user(id),
    executed_at TIMESTAMPTZ,
    bank_reference_number VARCHAR(128),
    execution_receipt_file_id UUID,
    CONSTRAINT chk_payment_sod_maker_checker CHECK (proposed_by != checked_by),
    CONSTRAINT chk_payment_sod_maker_executor CHECK (proposed_by != executed_by),
    CONSTRAINT chk_payment_sod_checker_executor CHECK (checked_by IS NULL OR executed_by IS NULL OR checked_by != executed_by)
);

CREATE TABLE IF NOT EXISTS payment_invoice_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_proposal_id UUID NOT NULL REFERENCES payment_proposal(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoice(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(18, 2) NOT NULL CHECK (allocated_amount > 0),
    is_advance_payment BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS idempotency_key_record (
    key VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id),
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_code INT,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================================
-- 9. AUDIT TRAIL & SYSTEM INTEGRITY DOMAIN (R51–R54)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_trail_entry (
    id BIGSERIAL PRIMARY KEY,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    actor_id UUID,
    actor_role app_role_enum,
    action_type VARCHAR(64) NOT NULL,
    entity_name VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    old_state JSONB,
    new_state JSONB,
    justification TEXT,
    ip_address INET NOT NULL,
    user_agent TEXT,
    previous_entry_hash VARCHAR(64),
    current_entry_hash VARCHAR(64) NOT NULL
);

DO $$ BEGIN
    CREATE RULE no_update_audit AS ON UPDATE TO audit_trail_entry DO INSTEAD NOTHING;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE RULE no_delete_audit AS ON DELETE TO audit_trail_entry DO INSTEAD NOTHING;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS file_attachment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    storage_object_key TEXT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    scan_status VARCHAR(32) NOT NULL DEFAULT 'SCANNING',
    is_final_evidence BOOLEAN NOT NULL DEFAULT FALSE,
    is_legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 10. OUTBOX & WEBHOOK INTEGRATION (R61)
-- ============================================================================

CREATE TABLE IF NOT EXISTS outbox_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at TIMESTAMPTZ,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE TABLE IF NOT EXISTS webhook_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_url TEXT NOT NULL,
    secret_key VARCHAR(128) NOT NULL,
    subscribed_events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 11. INDICES FOR PERFORMANCE (p95 < 2s)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pr_requester ON purchase_request(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_order(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_po ON invoice(po_id, match_status);
CREATE INDEX IF NOT EXISTS idx_invoice_search ON invoice(vendor_invoice_normalized, nsfp_normalized);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail_entry(entity_name, entity_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_file_attachment_entity ON file_attachment(entity_name, entity_id);

-- ============================================================================
-- 12. SEED DATA (7 Roles, 1 Fallback Admin User & Initial Tax Snapshot)
-- ============================================================================

-- Default Initial Tax Rule Snapshot (PPN 12%)
INSERT INTO tax_rule_snapshot (
    id, ppn_rate, dpp_factor, pph_article, pph_rate, tax_regulation_ref
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    0.1200,
    1.0000,
    'NONE',
    0.0000,
    'UU HPP No 7 Tahun 2021'
) ON CONFLICT (id) DO NOTHING;

-- Emergency Local Fallback Admin User (R1)
INSERT INTO app_user (
    id, email, full_name, employee_id, division_id, branch_id,
    is_active, is_local_fallback, totp_enabled
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin@nusanet.net.id',
    'Administrator Darurat (Fallback)',
    'EMP-ADMIN-FALLBACK',
    'IT_SECURITY',
    'HQ_MEDAN',
    TRUE,
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Default Role Assignment for Admin
INSERT INTO user_role_assignment (
    user_id, role, assigned_by, valid_from
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'ADMIN',
    '00000000-0000-0000-0000-000000000002',
    CURRENT_DATE
) ON CONFLICT (user_id, role) DO NOTHING;
