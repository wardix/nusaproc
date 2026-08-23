# TECHNICAL DESIGN DOCUMENT (TDD)

# NusaProc — Nusanet Procurement System (Fase 1)

**Status:** Ready for Review · **Versi:** 1.2.0 · **Rujukan:** [PRD Revisi 3 (23 Agustus 2026)](file:///home/anangmaruf/agy/nusaproc/prd.md)  
**Target Gate:** Persetujuan Gerbang M0  
**Target Platform:** On-Premise Infrastructure (PT Media Antar Nusa / Nusanet)  
**Tech Stack:** TypeScript on Bun, Built-in Bun SQL (Raw SQL, No ORM), PostgreSQL 16, Redis 7.2, MinIO, React 18 + Vite + Ant Design (antd v5)

---

## Daftar Isi

1. [Header dan Ringkasan Dokumen](#1-header-dan-ringkasan-dokumen)
2. [Arsitektur Sistem Tingkat Tinggi](#2-arsitektur-sistem-tingkat-tinggi)
3. [Standar Teknologi (Tech Stack)](#3-standar-teknologi-tech-stack)
4. [Arsitektur Domain & Struktur Proyek Backend (TypeScript/Bun)](#4-arsitektur-domain--struktur-proyek-backend-typescriptbun)
5. [Desain Database & Data Model (PostgreSQL & Bun SQL)](#5-desain-database--data-model-postgresql--bun-sql)
6. [Engine Autentikasi, RBAC & Separation of Duties (SoD)](#6-engine-autentikasi-rbac--separation-of-duties-sod)
7. [State Machine & Alur Bisnis Kritis](#7-state-machine--alur-bisnis-kritis)
8. [Spesifikasi REST API & Webhook (R61)](#8-spesifikasi-rest-api--webhook-r61)
9. [Pipeline Berkas, Validasi & Object Storage (R51, R52)](#9-pipeline-berkas-validasi--object-storage-r51-r52)
10. [Audit Trail & Integritas Kepatuhan (R53, R54)](#10-audit-trail--integritas-kepatuhan-r53-r54)
11. [Idempotency & Penanganan Kegagalan (R43, R62–R65)](#11-idempotency--penanganan-kegagalan-r43-r62r65)
12. [Arsitektur Frontend (React + Vite + Ant Design)](#12-arsitektur-frontend-react--vite--ant-design)
13. [Infrastruktur, Deployment & Pemenuhan NFR](#13-infrastruktur-deployment--pemenuhan-nfr)
14. [Verifikasi & Langkah Penerimaan Teknis (M0 Gate)](#14-verifikasi--langkah-penerimaan-teknis-m0-gate)

---

## 1. Header dan Ringkasan Dokumen

### 1.1 Metadata
| Atribut | Nilai |
| :--- | :--- |
| **Produk / Sistem** | NusaProc (Fase 1) |
| **Penyusun** | Technical Lead & Software Architecture Team |
| **Stakeholder Review** | Engineering, DevOps/Infra, Security, Product Owner, Finance Lead |
| **Referensi Dokumen** | PRD NusaProc Rev 3, DEC-032 (7 Roles Model), UU KUP Pasal 28, OWASP ASVS v4.0.3 L2 |

### 1.2 Tujuan Dokumen
Dokumen ini mendefinisikan arsitektur teknis, desain database, antarmuka pemrograman (API), model keamanan, arsitektur antarmuka pengguna (Frontend), dan topologi deployment untuk implementasi **NusaProc Fase 1**. Seluruh arsitektur memprioritaskan:
1. **Integritas Transaksional & Audit**: Data historis, snapshot pajak, dan jejak persetujuan tidak boleh dapat dimanipulasi (*tamper-proof*).
2. **Pencegahan Fraud Terotomasi**: Penegakan *Separation of Duties* (SoD) dan *Maker-Checker-Executor* di tingkat database dan application layer.
3. **On-Premise Ready**: Berjalan stabil di atas server internal Nusanet tanpa dependensi wajib ke cloud publik pihak ketiga.
4. **Zero ORM Overhead & High Concurrency**: Backend TypeScript dieksekusi di runtime **Bun** dengan **Raw SQL parameterized queries** via built-in `bun:sql` client.
5. **Enterprise-Grade UI**: Frontend berbasis **React 18 + Vite** dengan sistem komponen **Ant Design (antd v5)** yang responsif hingga layar ponsel $\ge 360\text{px}$.

---

## 2. Arsitektur Sistem Tingkat Tinggi

### 2.1 Pola Arsitektur: Modular Monolith
NusaProc mengadopsi pola **Modular Monolith** dengan batasan domain yang terisolasi (*strict bounded context boundaries*).

```mermaid
C4Container
    title Container Diagram - NusaProc System Architecture

    Person(user, "Nusanet Employee", "Requester, Approver, AP, Warehouse, Finance, Admin")
    Person_Ext(auditor, "External Auditor", "Read-only access for audit verification")

    System_Boundary(c1, "NusaProc On-Premise Boundary") {
        Container(spa, "Single Page Application (SPA)", "React 18+ / Vite / Ant Design (antd v5)", "Antarmuka enterprise responsif (>=360px), WCAG 2.2 AA, Bahasa Indonesia")
        Container(api_gw, "Reverse Proxy / Gateway", "Nginx / OpenResty", "SSL Termination, Rate Limiting, Security Headers, Static Asset Serving")
        Container(app, "Core Application Backend", "TypeScript on Bun (Hono / Bun.serve)", "Modular Monolith: Domain Services, RBAC & SoD Interceptor, State Machines, Raw Bun SQL")
        Container(worker, "Async Background Worker", "TypeScript on Bun Worker Pool", "File scanning, bulk export generator, email notification, webhook dispatcher")
        
        ContainerDb(pg, "Primary Database", "PostgreSQL 16", "OLTP engine, JSONB snapshot store, row-level locking, ACID transactions")
        ContainerDb(redis, "In-Memory Store & Broker", "Redis 7.2", "Session caching, idempotency keys, distributed lock, task queue broker")
        ContainerDb(minio, "Object Storage Cluster", "MinIO (Distributed)", "Immutable evidence storage, WORM retention (10 years), bucket lifecycle")
    }

    System_Ext(google_auth, "Google Workspace Identity", "OAuth2 / OIDC for enterprise SSO")
    System_Ext(smtp, "Internal Mail Server", "SMTP relay for alert & notifications")
    System_Ext(clamav, "Antivirus Scanner", "ClamAV daemon for file attachment inspection")

    Rel(user, api_gw, "HTTPS / REST", "JSON")
    Rel(auditor, api_gw, "HTTPS / REST", "JSON")
    Rel(api_gw, spa, "Serves", "Static files")
    Rel(api_gw, app, "Routes /api/*", "HTTP Reverse Proxy")

    Rel(app, pg, "Read / Write (Raw SQL)", "bun:sql native pool")
    Rel(app, redis, "Cache & Queue", "RESP protocol / ioredis")
    Rel(app, google_auth, "Validate Token / OIDC", "HTTPS")
    Rel(app, minio, "Presigned URLs & S3 API", "S3 Protocol / AWS SDK v3")

    Rel(worker, redis, "Consume Tasks", "Redis Streams")
    Rel(worker, clamav, "Scan File Streams", "TCP / clamd")
    Rel(worker, smtp, "Send Notifications", "Nodemailer / SMTP")
    Rel(worker, pg, "Update Status & Audit", "bun:sql native pool")
```

---

## 3. Standar Teknologi (Tech Stack)

| Komponen | Pilihan Teknologi | Versi Target | Rasional Teknis |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | **Bun** | **v1.1+** | Eksekusi TypeScript native tanpa compiler terpisah, startup instan, package manager ultra-cepat, built-in test runner (`bun test`). |
| **Backend Language** | **TypeScript** | **v5.4+** | Strict type-safety, mencegah runtime errors, shared types dengan frontend. |
| **Database Access** | **Built-in Bun SQL (`bun:sql`)** | **Native** | Driver PostgreSQL internal C++ native. Parameterized tagged template queries (`sql`...``) mencegah SQL Injection. **Zero ORM** untuk transparansi query dan performa maksimal. |
| **Web Router** | **Hono / Bun.serve** | **v4.4+** | Router ultra-ringan dengan *middleware chaining* untuk 5-layer SoD engine. |
| **Database** | **PostgreSQL** | **16.x** | ACID compliance, `UUIDv7`, operator `JSONB` kaya untuk immutable snapshot, *window functions* untuk 2-way matching. |
| **In-Memory & Queue** | **Redis** | **7.2+** | Atomic lock (`SETNX` untuk idempotency R43), Streams untuk background worker dan webhook retry. |
| **Object Storage** | **MinIO** | **RELEASE.2024+** | S3-compatible, WORM retention policy (10 tahun UU KUP Pasal 28). |
| **Frontend Framework** | **React + Vite** | **React 18.3+ / Vite 5+** | Ekosistem enterprise paling matang, HMR instan, eksekusi SPA cepat. |
| **UI Design System** | **Ant Design (antd)** | **v5.18+** | Standar industri enterprise untuk ERP & pengadaan: Table kompleks, Form.List dinamis, Steps approval, Drawer, Modal. |
| **UI Iconography** | **@ant-design/icons** | **v5.3+** | Koleksi icon lengkap konsisten dengan design token Ant Design. |
| **Client State** | **Zustand** | **v4.5+** | Manajemen client state ringan (Active Role Switcher, User Session, Preferences). |
| **Server State & Cache** | **TanStack Query (React Query)** | **v5.35+** | Manajemen cache data server, background refetch, pagination caching, query invalidation otomatis. |
| **HTTP Client** | **Axios** | **v1.7+** | Request/Response Interceptor untuk otomatisasi Step-Up Re-Auth (`R5`) dan Idempotency-Key (`R43`). |
| **Document Engine** | **PDFKit / Typst-TS** | **Latest** | Deterministic PDF generation untuk Surat Pesanan (PO) resmi (R27). |
| **Security & Scanner** | **ClamAV Daemon + File-Type** | **Latest On-Prem** | Pemeriksaan virus lokal via TCP socket dan verifikasi binary magic bytes sebelum commit bukti final (R51). |

---

## 4. Arsitektur Domain & Struktur Proyek Backend (TypeScript/Bun)

```
backend/
├── src/
│   ├── config/             # Environment validation, database config, Redis client
│   ├── db/
│   │   ├── client.ts       # Singleton Bun SQL instance (import { sql } from "bun:sql")
│   │   └── migrations/     # Raw SQL migration files (001_initial.sql, 002_views.sql)
│   ├── domain/
│   │   ├── auth/           # Google OIDC SSO, User, Role, Delegation, Re-auth Token
│   │   ├── sod/            # Separation of Duties Rule Engine & Matrix Validator
│   │   ├── vendor/         # Master Vendor, Bank Accounts (4-Eyes), Scoring
│   │   ├── pr/             # Purchase Request, Multi-items, Payment Method Flag
│   │   ├── approval/       # Rule-based Engine, Snapshot Router, Approvals
│   │   ├── po/             # Purchase Order, Line items mapping, Amendments
│   │   ├── receipt/        # Goods/Service Receipt (BAST), Non-Conformance (NCR)
│   │   ├── invoice/        # Dual-NSFP, Tax Rule Snapshot, 2-Way Matcher, Exceptions
│   │   ├── payment/        # Maker-Checker-Executor, Advance Payment, Idempotency
│   │   ├── audit/          # Append-only immutable log, Evidence packager
│   │   └── integration/    # Webhook dispatcher, Outbox Processor, REST API specs
│   ├── middleware/         # 5-Layer Security Interceptors (Auth, RBAC, SoD, Re-Auth)
│   ├── workers/            # Background tasks (ClamAV, Webhook dispatch, Outbox runner)
│   └── index.ts            # Entrypoint (Bun.serve / Hono app instance)
```

---

## 5. Desain Database & Data Model (PostgreSQL & Bun SQL)

### 5.1 Standar Konvensi Database
1. **Primary Keys**: Menggunakan `UUIDv7` (time-ordered UUID) untuk performa index B-Tree yang optimal.
2. **Waktu & Zona Waktu**: Seluruh kolom waktu disimpan sebagai `TIMESTAMPTZ` dalam format UTC. Tampilan dikonversi ke `Asia/Jakarta`.
3. **Nilai Moneter**: Disimpan dalam tipe data `NUMERIC(18, 2)` (tidak pernah menggunakan `FLOAT`).
4. **Soft Delete**: Data historis tidak dihapus secara fisik; menggunakan kolom `is_active BOOLEAN` dan `deactivated_at TIMESTAMPTZ`.

---

### 5.2 Skema DDL Lengkap (PostgreSQL 16)

```sql
-- Extension setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. AUTHENTICATION, RBAC & DELEGATION DOMAIN
-- ============================================================================

CREATE TYPE app_role_enum AS ENUM (
    'REQUESTER',
    'APPROVER',
    'ACCOUNT_PAYABLE',
    'WAREHOUSE',
    'FINANCE',
    'AUDITOR',
    'ADMIN'
);

CREATE TABLE app_user (
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

CREATE TABLE user_role_assignment (
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

CREATE TABLE approval_delegation (
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
-- 2. VENDOR & TEMPORAL BANK ACCOUNT DOMAIN (R17, R18, R19)
-- ============================================================================

CREATE TYPE vendor_status_enum AS ENUM ('PROSPECTIVE', 'APPROVED', 'SUSPENDED', 'BLACKLISTED');
CREATE TYPE bank_account_status_enum AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'INACTIVE');

CREATE TABLE vendor (
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

CREATE TABLE vendor_bank_account (
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

CREATE TABLE vendor_performance_rating (
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
-- 3. PURCHASE REQUEST (PR) & APPROVAL DOMAIN (R6–R16, R48)
-- ============================================================================

CREATE TYPE payment_term_type_enum AS ENUM ('ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT');
CREATE TYPE pr_status_enum AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED_PARTIAL');
CREATE TYPE approval_decision_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE purchase_request (
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

CREATE TABLE purchase_request_item (
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

CREATE TABLE approval_instance (
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

CREATE TABLE emergency_post_review (
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
-- 4. PURCHASE ORDER (PO) & SOURCING DOMAIN (R20–R27)
-- ============================================================================

CREATE TYPE po_status_enum AS ENUM ('DRAFT', 'ISSUED', 'AMENDED', 'COMPLETED', 'CANCELLED');

CREATE TABLE vendor_quotation (
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

CREATE TABLE purchase_order (
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

CREATE TABLE purchase_order_item (
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

CREATE TABLE po_amendment_history (
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
-- 5. GOODS RECEIPT (BAST) & NCR DOMAIN (R28–R32)
-- ============================================================================

CREATE TYPE receipt_type_enum AS ENUM ('DIRECT_REQUESTER', 'WAREHOUSE');

CREATE TABLE goods_receipt (
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

CREATE TABLE goods_receipt_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_id UUID NOT NULL REFERENCES goods_receipt(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES purchase_order_item(id) ON DELETE RESTRICT,
    quantity_received NUMERIC(12, 2) NOT NULL CHECK (quantity_received >= 0),
    quantity_rejected NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (quantity_rejected >= 0),
    condition_notes TEXT
);

CREATE TABLE non_conformance_report (
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
-- 6. INVOICE, TAX SNAPSHOT & 2-WAY MATCHING (R33–R40)
-- ============================================================================

CREATE TYPE invoice_type_enum AS ENUM ('STANDARD', 'ADVANCE_PAYMENT', 'PROGRESS_TERMIN', 'FINAL_SETTLEMENT', 'CREDIT_NOTE', 'DEBIT_NOTE');
CREATE TYPE match_status_enum AS ENUM ('UNMATCHED', 'MATCHED_OK', 'MATCHED_WITH_EXCEPTION', 'EXCEPTION_OVERRIDDEN');

CREATE TABLE tax_rule_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ppn_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1200,
    dpp_factor NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
    pph_article VARCHAR(16),
    pph_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    tax_regulation_ref VARCHAR(255) NOT NULL
);

CREATE TABLE invoice (
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

CREATE TABLE invoice_matching_exception (
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
-- 7. PAYMENT & IDEMPOTENCY DOMAIN (R41–R47)
-- ============================================================================

CREATE TYPE payment_proposal_status_enum AS ENUM ('PROPOSED', 'CHECKED', 'EXECUTED', 'REJECTED', 'CANCELLED');

CREATE TABLE payment_proposal (
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

CREATE TABLE payment_invoice_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_proposal_id UUID NOT NULL REFERENCES payment_proposal(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoice(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(18, 2) NOT NULL CHECK (allocated_amount > 0),
    is_advance_payment BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE idempotency_key_record (
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
-- 8. AUDIT TRAIL & SYSTEM INTEGRITY DOMAIN (R51–R54)
-- ============================================================================

CREATE TABLE audit_trail_entry (
    id BIGSERIAL PRIMARY KEY,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    actor_id UUID REFERENCES app_user(id),
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

CREATE RULE no_update_audit AS ON UPDATE TO audit_trail_entry DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_trail_entry DO INSTEAD NOTHING;

CREATE TABLE file_attachment (
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
-- 9. OUTBOX & WEBHOOK INTEGRATION (R61)
-- ============================================================================

CREATE TABLE outbox_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at TIMESTAMPTZ,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE TABLE webhook_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_url TEXT NOT NULL,
    secret_key VARCHAR(128) NOT NULL,
    subscribed_events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indices for p95 < 2s
CREATE INDEX idx_pr_requester ON purchase_request(requester_id, status);
CREATE INDEX idx_po_vendor ON purchase_order(vendor_id, status);
CREATE INDEX idx_invoice_po ON invoice(po_id, match_status);
CREATE INDEX idx_invoice_search ON invoice(vendor_invoice_normalized, nsfp_normalized);
CREATE INDEX idx_audit_entity ON audit_trail_entry(entity_name, entity_id, event_timestamp);
CREATE INDEX idx_file_attachment_entity ON file_attachment(entity_name, entity_id);
```

---

### 5.3 Implementasi Raw Database Client dengan `bun:sql`

```typescript
// src/db/client.ts
import { SQL } from "bun";

export const sql = new SQL({
  url: process.env.DATABASE_URL || "postgres://nusaproc:secret@localhost:5432/nusaproc_db",
  max: 20,
  idleTimeout: 30,
  tls: process.env.NODE_ENV === "production",
});

export type TransactionClient = typeof sql;

export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return await sql.begin(async (tx) => {
    return await callback(tx);
  });
}
```

---

## 6. Engine Autentikasi, RBAC & Separation of Duties (SoD)

### 6.1 Alur 5-Layer Security Interceptor

Setiap request yang memodifikasi state transaksi melewati 5 lapisan verifikasi:

```mermaid
flowchart TD
    REQ["HTTP Request Inbound"]
    L1["Layer 1: JWT & Session Validation\n(Google OIDC / Local TOTP)"]
    L2["Layer 2: RBAC Role Verification\n(Does user have assigned Role?)"]
    L3["Layer 3: SoD Conflict Engine\n(Matrix check against transaction history)"]
    L4["Layer 4: Scope & Delegation Guard\n(Amount Limit, Division, Delegation Period)"]
    L5["Layer 5: Step-Up Re-Authentication\n(Mandatory for High-Risk Actions: R5, R43)"]
    EXEC["Execute Domain Handler\nWithin ACID sql.begin Transaction"]
    REJ["HTTP 403 / 401 Rejection\n+ Security Audit Logged"]

    REQ --> L1
    L1 -->|Valid| L2
    L1 -->|Invalid| REJ
    L2 -->|Authorized| L3
    L2 -->|Unauthorized| REJ
    L3 -->|No Conflict| L4
    L3 -->|Conflict Detected| REJ
    L4 -->|Within Limits| L5
    L4 -->|Out of Scope| REJ
    L5 -->|Re-Auth Success| EXEC
    L5 -->|Re-Auth Failed| REJ

    style EXEC fill:#22c55e,color:#fff
    style REJ fill:#ef4444,color:#fff
```

### 6.2 SoD Conflict Matrix Implementation (TypeScript Engine)

```typescript
// src/domain/sod/validator.ts

export interface TransactionActors {
  prRequesterId?: string;
  poAuthorId?: string;
  poApproverId?: string;
  goodsReceiverId?: string;
  paymentProposerId?: string;
  paymentCheckerId?: string;
  paymentExecutorId?: string;
}

export type ActionType =
  | "APPROVE_PR"
  | "APPROVE_PO"
  | "RECEIVE_GOODS"
  | "CHECK_PAYMENT"
  | "EXECUTE_PAYMENT";

export class SodConflictError extends Error {
  constructor(message: string, public readonly ruleCode: string) {
    super(message);
    this.name = "SodConflictError";
  }
}

export function validateSodAction(
  currentActorId: string,
  action: ActionType,
  actors: TransactionActors
): void {
  switch (action) {
    case "APPROVE_PR":
      if (actors.prRequesterId && actors.prRequesterId === currentActorId) {
        throw new SodConflictError(
          "Pelanggaran SoD: Requester tidak boleh menyetujui PR miliknya sendiri.",
          "R15_SELF_APPROVAL"
        );
      }
      break;

    case "APPROVE_PO":
      if (actors.poAuthorId && actors.poAuthorId === currentActorId) {
        throw new SodConflictError(
          "Pelanggaran SoD: Pembuat PO tidak boleh menyetujui PO yang sama.",
          "R25_PO_AUTHOR_CANNOT_APPROVE"
        );
      }
      break;

    case "RECEIVE_GOODS":
      if (actors.poAuthorId && actors.poAuthorId === currentActorId) {
        throw new SodConflictError(
          "Pelanggaran SoD: Pembuat PO tidak boleh mencatat penerimaan barang transaksi yang sama.",
          "R31_PO_AUTHOR_CANNOT_RECEIVE"
        );
      }
      if (actors.poApproverId && actors.poApproverId === currentActorId) {
        throw new SodConflictError(
          "Pelanggaran SoD: Penyetuju PO tidak boleh mencatat penerimaan barang transaksi yang sama.",
          "R31_PO_APPROVER_CANNOT_RECEIVE"
        );
      }
      break;

    case "CHECK_PAYMENT":
      if (actors.paymentProposerId && actors.paymentProposerId === currentActorId) {
        throw new SodConflictError(
          "Pelanggaran SoD: Pengusul pembayaran (Maker) tidak boleh memeriksa usulannya sendiri (Checker).",
          "R42_MAKER_CANNOT_CHECK"
        );
      }
      break;

    case "EXECUTE_PAYMENT":
      if (
        (actors.paymentProposerId && actors.paymentProposerId === currentActorId) ||
        (actors.paymentCheckerId && actors.paymentCheckerId === currentActorId)
      ) {
        throw new SodConflictError(
          "Pelanggaran SoD: Pelaksana transfer (Executor) wajib berbeda dari Maker dan Checker.",
          "R42_EXECUTOR_MUST_BE_DISTINCT"
        );
      }
      break;
  }
}
```

---

## 7. State Machine & Alur Bisnis Kritis

### 7.1 State Machine Purchase Request (PR)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Requester creates PR
    DRAFT --> SUBMITTED: Submit (Lock Approval Policy R12)
    DRAFT --> CANCELLED: Requester cancels
    SUBMITTED --> APPROVED: All approvers sign
    SUBMITTED --> REJECTED: Any approver rejects (With reason R14)
    APPROVED --> CLOSED_PARTIAL: Partial PO issued + remainder closed (R11)
    APPROVED --> [*]: Fully converted to PO
    REJECTED --> [*]: Final state (No revision R9 - Create new PR)
    CANCELLED --> [*]
```

### 7.2 Alur 2-Way Matching Engine & Toleransi (R37, R38)

```mermaid
flowchart TD
    INV["Invoice Diinput\n(Subtotal, PPN, PPh, Qty, NSFP)"]
    PO_FETCH["Ambil Baris PO & Snapshot Aturan Pajak via bun:sql"]
    
    COMP_QTY["1. Komparasi Kuantitas: (Qty Invoiced vs Qty PO)"]
    COMP_PRICE["2. Komparasi Harga: (Price Invoiced vs Unit Price PO)"]
    COMP_TAX["3. Komparasi Pajak: Validasi Faktur NSFP & Tarif Snapshot"]
    
    CHECK_TOL{"Selisih Total <= 1% atau\n<= Rp 100.000?"}
    
    MATCH_OK["Status: MATCHED_OK\nMasuk Antrean Siap Bayar"]
    MATCH_EXC["Status: MATCHED_WITH_EXCEPTION\nInvoice Ditahan (Held)"]
    
    OVERRIDE{"Head of AP Override?\n(Wajib Bukti Tertulis R39)"}
    
    INV --> PO_FETCH --> COMP_QTY --> COMP_PRICE --> COMP_TAX --> CHECK_TOL
    CHECK_TOL -->|Ya| MATCH_OK
    CHECK_TOL -->|Tidak| MATCH_EXC
    MATCH_EXC --> OVERRIDE
    OVERRIDE -->|Disetujui| MATCH_OK
    OVERRIDE -->|Ditolak| INV
```

---

## 8. Spesifikasi REST API & Webhook (R61)

### 8.1 Standar REST API
- **Base URL**: `/api/v1`
- **Format Response Standar**: RFC 7807 (`application/problem+json`) untuk error.
- **Envelope Response Sukses**:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "per_page": 20,
    "total_records": 1250
  }
}
```

### 8.2 Endpoints Kunci

| Method | Path | Role Minimal | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login-google` | Public | Autentikasi Google Workspace OIDC |
| `POST` | `/api/v1/auth/reauth` | Any | Verifikasi kredensial ulang untuk step-up (R5) |
| `POST` | `/api/v1/purchase-requests` | Requester | Buat draft PR baru |
| `POST` | `/api/v1/purchase-requests/:id/submit` | Requester | Submit PR & lock approval route |
| `POST` | `/api/v1/approvals/:id/decide` | Approver | Setujui / Tolak PR dengan alasan |
| `POST` | `/api/v1/vendors` | AP | Daftarkan calon pemasok baru |
| `POST` | `/api/v1/vendors/:id/verify-bank` | AP / Finance | Verifikasi rekening bank (4-eyes) |
| `POST` | `/api/v1/purchase-orders` | AP | Buat draft PO dari PR |
| `POST` | `/api/v1/purchase-orders/:id/issue` | AP (Distinct) | Terbitkan PO (menghasilkan PDF) |
| `POST` | `/api/v1/receipts` | Requester / WH | Catat BAST & upload invoice (R29) |
| `POST` | `/api/v1/invoices/match` | Finance / System | Jalankan kalkulasi 2-way matching |
| `POST` | `/api/v1/payments/propose` | Finance (Maker) | Buat usulan pembayaran |
| `POST` | `/api/v1/payments/:id/check` | Finance (Checker) | Verifikasi usulan pembayaran |
| `POST` | `/api/v1/payments/:id/execute` | Finance (Exec) | Eksekusi transfer (Idempotent R43) |
| `GET` | `/api/v1/audits/export-package` | Auditor | Unduh bundle bukti terenkripsi (R54) |

### 8.3 Webhook Event Architecture (R61)
Payload dikirim melalui HTTPS POST dengan signature header `X-NusaProc-Signature: sha256=<hex_hmac>` yang dihasilkan dari `HMAC_SHA256(payload, webhook_secret)`.

---

## 9. Pipeline Berkas, Validasi & Object Storage (R51, R52)

### 9.1 Alur Upload & Asynchronous Scanning Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Client as SPA Client
    participant API as NusaProc Backend (Bun)
    participant MinIO as MinIO Object Storage
    participant Worker as Bun ClamAV Worker
    participant DB as PostgreSQL (bun:sql)

    Client->>API: POST /api/v1/attachments/presign (file_name, size, mime)
    API->>API: Validasi MIME & Max Size (15 MB)
    API->>MinIO: Generate Presigned PUT URL
    API-->>Client: Presigned URL & file_attachment_id
    Client->>MinIO: Direct Upload Binary Stream
    Client->>API: POST /api/v1/attachments/:id/complete
    API->>DB: Status: SCANNING
    API->>Worker: Enqueue Scan Job (attachment_id)
    Worker->>MinIO: Get Object Stream
    Worker->>Worker: Check Magic Bytes + Scan Virus (ClamAV)
    Worker->>Worker: Compute SHA-256 Checksum
    alt File Terinfeksi Virus
        Worker->>MinIO: Delete Object
        Worker->>DB: Status: INFECTED, Flag Error
    else File Bersih
        Worker->>MinIO: Apply WORM Legal Hold Tag
        Worker->>DB: Status: CLEAN, is_final_evidence = TRUE, sha256_checksum
    end
```

---

## 10. Audit Trail & Integritas Kepatuhan (R53, R54)

### 10.1 Cryptographic Hash Chaining (Tamper Evidence)
Setiap record dalam `audit_trail_entry` membentuk rantai kriptografis (*cryptographic blockchain-style hash chain*):

$$\text{current\_entry\_hash} = \text{SHA256}(\text{id} \parallel \text{event\_timestamp} \parallel \text{actor\_id} \parallel \text{action\_type} \parallel \text{entity\_id} \parallel \text{new\_state} \parallel \text{previous\_entry\_hash})$$

### 10.2 Auditor Read-Only Sandbox & Evidence Bundle (R54)
Auditor eksternal diberikan akun khusus dengan middleware `AuditorScopeMiddleware` yang membatasi HTTP method hanya `GET`. Tombol mutasi dinonaktifkan di UI dan diblokir total di API layer (HTTP 405 Method Not Allowed).

---

## 11. Idempotency & Penanganan Kegagalan (R43, R62–R65)

### 11.1 Idempotency Engine pada Eksekusi Pembayaran (R43)

```typescript
// src/domain/payment/idempotency.ts
import { sql } from "../../db/client";
import { redis } from "../../config/redis";

export async function executeIdempotentPayment(
  idempotencyKey: string,
  userId: string,
  paymentProposalId: string,
  executeFn: () => Promise<Record<string, any>>
) {
  const lockKey = `idempotency:lock:${idempotencyKey}`;
  
  const acquired = await redis.set(lockKey, "PROCESSING", "EX", 120, "NX");
  if (!acquired) {
    const [existing] = await sql<[{ response_body: Record<string, any>; response_code: number }]>`
      SELECT response_body, response_code
      FROM idempotency_key_record
      WHERE key = ${idempotencyKey}
    `;

    if (existing) {
      return { status: existing.response_code, data: existing.response_body };
    }

    throw new Error("Transaksi sedang diproses oleh permintaan lain (HTTP 409).");
  }

  try {
    const result = await executeFn();

    await sql`
      INSERT INTO idempotency_key_record (
        key, user_id, endpoint, request_hash, response_code, response_body, expires_at
      ) VALUES (
        ${idempotencyKey}, ${userId}, '/api/v1/payments/execute',
        ${Bun.SHA256.hash(idempotencyKey, "hex")}, 200, ${JSON.stringify(result)},
        NOW() + INTERVAL '24 HOURS'
      )
    `;

    return { status: 200, data: result };
  } finally {
    await redis.del(lockKey);
  }
}
```

---

## 12. Arsitektur Frontend (React + Vite + Ant Design)

### 12.1 Struktur Proyek Frontend

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts         # Axios instance dengan Interceptor Re-Auth (R5) & Idempotency (R43)
│   │   └── endpoints/        # Typed API functions (pr.ts, po.ts, invoice.ts, payment.ts)
│   ├── assets/               # Nusanet branding logos, icons
│   ├── components/
│   │   ├── common/           # ErrorBoundary, PageHeader, StatusTag, EmptyState
│   │   ├── layout/           # AppLayout, AppHeader, AppSidebar, RoleSwitcherDropdown (US14)
│   │   └── security/         # StepUpReauthModal (R5), AuditorWatermark (R54)
│   ├── features/             # Feature-Driven Modular Architecture
│   │   ├── auth/             # GoogleLoginButton, LocalFallbackForm, TotpVerifyModal
│   │   ├── dashboard/        # RoleActionQueue, SLAIndicatorBadge, MetricCards (R56)
│   │   ├── pr/               # PrFormListTable, PrCreatePage, PrDetailDrawer, PrTimeline
│   │   ├── po/               # PoDataTable, PoAmendmentModal, PoPdfPreviewModal (R27)
│   │   ├── receipt/          # GoodsReceiptForm (BAST) + Simultaneous Invoice Upload (R29)
│   │   ├── invoice/          # InvoiceMatcherScreen (Side-by-Side), DualNsfpInput (R35)
│   │   ├── payment/          # MakerCheckerSteps, PaymentProposalTable, ExecuteTransferModal (R42)
│   │   └── audit/            # AuditorExplorerTable, AuditLogTimeline, BulkExportModal (R54)
│   ├── hooks/                # useActiveRole, useStepUpReauth, useIdempotencyKey
│   ├── stores/               # Zustand: useAuthStore, useRoleStore, useUiStore
│   ├── types/                # Shared TypeScript models (mirrored from backend)
│   ├── utils/                # Currency IDR formatter, Date Asia/Jakarta formatter
│   ├── App.tsx               # Antd ConfigProvider (Locale id_ID & Theme), QueryClientProvider
│   └── main.tsx              # React entry point
├── package.json
└── vite.config.ts
```

### 12.2 Konfigurasi Ant Design Theme & Lokalitas Bahasa Indonesia (`App.tsx`)

```tsx
// frontend/src/App.tsx
import React from 'react';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import idID from 'antd/locale/id_ID';
import 'dayjs/locale/id';
import dayjs from 'dayjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { StepUpReauthModal } from './components/security/StepUpReauthModal';

dayjs.locale('id');
const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={idID}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#0052CC', // Nusanet Corporate Blue
            colorSuccess: '#389E0D',
            colorWarning: '#D48806',
            colorError: '#CF1322',
            borderRadius: 6,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          components: {
            Table: {
              headerBg: '#FAFAFA',
              headerColor: '#1F1F1F',
              rowHoverBg: '#F0F5FF',
            },
            Button: {
              controlHeight: 38,
              borderRadius: 6,
            },
          },
        }}
      >
        <AntdApp>
          <RouterProvider router={router} />
          {/* Global Re-Authentication Modal Interceptor (R5, R43) */}
          <StepUpReauthModal />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};
```

---

### 12.3 Komponen Kritis Frontend

#### 1. Form PR Multi-Item dengan `Form.List` & Penanda Cara Bayar (R6, R7)

```tsx
// frontend/src/features/pr/components/PrCreateForm.tsx
import React from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Button, Card, Space, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { formatRupiah } from '../../../utils/currency';

const { Text } = Typography;

export const PrCreateForm: React.FC = () => {
  const [form] = Form.useForm();
  const watchedItems = Form.useWatch('items', form) || [];

  // Kalkulasi total estimasi otomatis secara reaktif
  const grandTotal = watchedItems.reduce((acc: number, item: any) => {
    const qty = Number(item?.quantityRequested) || 0;
    const price = Number(item?.estimatedUnitPrice) || 0;
    return acc + qty * price;
  }, 0);

  return (
    <Form form={form} layout="vertical" onFinish={(values) => console.log(values)}>
      <Card title="Informasi Permintaan Pembelian" style={{ marginBottom: 24 }}>
        <Form.Item
          name="paymentTermType"
          label="Metode Pembayaran yang Diajukan (R7)"
          rules={[{ required: true, message: 'Wajib memilih cara bayar!' }]}
        >
          <Select placeholder="Pilih cara pembayaran">
            <Select.Option value="ADVANCE_OR_COD">Bayar Dimuka / COD (Jalur Uang Muka)</Select.Option>
            <Select.Option value="PAY_AFTER_RECEIPT">Bayar Setelah Terima (Jalur Standar)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="requiredDate" label="Tanggal Kebutuhan" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Card>

      <Card title="Daftar Item Barang / Jasa (R6)">
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }, index) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'itemName']}
                    rules={[{ required: true, message: 'Nama item wajib diisi' }]}
                  >
                    <Input placeholder="Nama Barang / Jasa" style={{ width: 220 }} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'quantityRequested']}
                    rules={[{ required: true, message: 'Qty > 0' }]}
                  >
                    <InputNumber min={1} placeholder="Qty" style={{ width: 90 }} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'uom']}
                    rules={[{ required: true, message: 'Satuan' }]}
                  >
                    <Input placeholder="Satuan (Pcs/Unit)" style={{ width: 120 }} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'estimatedUnitPrice']}
                    rules={[{ required: true, message: 'Harga' }]}
                  >
                    <InputNumber
                      min={0}
                      formatter={(val) => `Rp ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      parser={(val) => val!.replace(/\Rp\s?|(\.*)/g, '')}
                      placeholder="Estimasi Harga"
                      style={{ width: 180 }}
                    />
                  </Form.Item>

                  <DeleteOutlined onClick={() => remove(name)} style={{ color: '#FF4D4F' }} />
                </Space>
              ))}

              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Tambah Baris Item
              </Button>
            </>
          )}
        </Form.List>

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Text strong style={{ fontSize: 16 }}>
            Total Estimasi Anggaran: {formatRupiah(grandTotal)}
          </Text>
        </div>
      </Card>

      <Button type="primary" htmlType="submit" size="large" style={{ marginTop: 24 }}>
        Kirim Permintaan Pembelian
      </Button>
    </Form>
  );
};
```

---

#### 2. Layar Visual Komparasi 2-Way Matcher (R37, R38)

```tsx
// frontend/src/features/invoice/components/TwoWayMatcherScreen.tsx
import React from 'react';
import { Card, Row, Col, Table, Tag, Typography, Alert, Button, Space } from 'antd';
import { formatRupiah } from '../../../utils/currency';

const { Title, Text } = Typography;

interface MatcherProps {
  poData: { poNumber: string; totalAmount: number; items: any[] };
  invoiceData: { invoiceNumber: string; subtotalAmount: number; variance: number; variancePct: number };
}

export const TwoWayMatcherScreen: React.FC<MatcherProps> = ({ poData, invoiceData }) => {
  const isWithinTolerance = Math.abs(invoiceData.variance) <= 100000 || invoiceData.variancePct <= 1.0;
  const isExactMatch = invoiceData.variance === 0;

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title={`Surat Pesanan: ${poData.poNumber}`} bordered={false}>
            <Text type="secondary">Total Nilai PO Resmi:</Text>
            <Title level={4}>{formatRupiah(poData.totalAmount)}</Title>
          </Card>
        </Col>

        <Col span={12}>
          <Card title={`Invoice Vendor: ${invoiceData.invoiceNumber}`} bordered={false}>
            <Text type="secondary">Total Tagihan:</Text>
            <Title level={4}>{formatRupiah(invoiceData.subtotalAmount)}</Title>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="Hasil Kalkulasi 2-Way Matching Engine">
        {isExactMatch ? (
          <Alert message="Pencocokan Sempurna (100% Cocok)" type="success" showIcon />
        ) : isWithinTolerance ? (
          <Alert
            message={`Selisih dalam Batas Wajar (${invoiceData.variancePct}% / ${formatRupiah(invoiceData.variance)})`}
            description="Invoice diizinkan masuk ke antrean pembayaran."
            type="warning"
            showIcon
          />
        ) : (
          <Alert
            message={`Selisih di Luar Batas Wajar (${formatRupiah(invoiceData.variance)})`}
            description="Invoice DITAHAN (Held). Memerlukan persetujuan tertulis Head of AP untuk pelepasan penandaan (R39)."
            type="error"
            showIcon
          />
        )}
      </Card>
    </div>
  );
};
```

---

#### 3. Axios Global Interceptor untuk Step-Up Re-Authentication (R5, R43)

```typescript
// frontend/src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Jika backend meminta step-up re-authentication
    if (error.response?.status === 401 && error.response?.data?.error === 'STEP_UP_REQUIRED') {
      const { triggerStepUpModal } = useAuthStore.getState();

      // Buka modal PIN/Password dan tunggu sampai user menyelesaikan re-auth
      const reauthToken = await triggerStepUpModal();

      if (reauthToken) {
        originalRequest.headers['X-Reauth-Token'] = reauthToken;
        return apiClient(originalRequest); // Retry request asli
      }
    }

    return Promise.reject(error);
  }
);
```

---

#### 4. Responsif Mobile Viewport ($\ge 360\text{px}$)
* Menggunakan Ant Design `Grid.useBreakpoint()`:
  - Pada layar ponsel (`xs: < 576px`), tabel beralih ke format kartu vertikal (*card list*).
  - Tombol aksi persetujuan (*Approve* / *Reject*) memiliki tinggi minimum $\ge 44\text{px}$ dan lebar penuh (`block={true}`) untuk kemudahan sentuhan satu tangan.

---

## 13. Infrastruktur, Deployment & Pemenuhan NFR

### 13.1 Topologi Deployment On-Premise

```mermaid
graph TD
    subgraph INGRESS["External / Office Network"]
        LB["Nginx Load Balancer / Reverse Proxy\n(Serves React SPA & Proxies /api)"]
    end

    subgraph APP_TIER["Application Tier (Bun Runtime)"]
        NODE1["NusaProc App Node 1 (Bun / TS)"]
        NODE2["NusaProc App Node 2 (Bun / TS)"]
        WORKER1["NusaProc Worker Node (Bun / TS)"]
    end

    subgraph DATA_TIER["State & Storage Tier"]
        PG_PRIMARY[("PostgreSQL 16 (Primary)")]
        PG_STANDBY[("PostgreSQL 16 (Standby / Streaming Rep)")]
        REDIS_NODE[("Redis Cluster / Sentinel")]
        MINIO_CLUSTER[("MinIO Distributed Storage (4 Nodes)")]
    end

    LB --> NODE1
    LB --> NODE2
    NODE1 --> PG_PRIMARY
    NODE2 --> PG_PRIMARY
    NODE1 --> REDIS_NODE
    NODE2 --> REDIS_NODE
    NODE1 --> MINIO_CLUSTER
    NODE2 --> MINIO_CLUSTER

    WORKER1 --> REDIS_NODE
    WORKER1 --> PG_PRIMARY
    WORKER1 --> MINIO_CLUSTER

    PG_PRIMARY -.->|WAL Streaming Replication| PG_STANDBY
```

### 13.2 Konfigurasi Nginx untuk React SPA & Backend Proxy

```nginx
# /etc/nginx/sites-available/nusaproc.conf
server {
    listen 443 ssl http2;
    server_name procurement.nusanet.id;

    ssl_certificate /etc/ssl/certs/nusaproc.crt;
    ssl_certificate_key /etc/ssl/private/nusaproc.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 1. Frontend Static Asset Serving (Vite Build Output)
    root /var/www/nusaproc/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Backend API Proxy ke Bun Runtime
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 13.3 Backup & Disaster Recovery (RPO <= 4h, RTO <= 4h)
1. **Continuous WAL Archiving**: WAL (Write-Ahead Logging) PostgreSQL diarsipkan setiap 15 menit ke secondary storage node.
2. **Nightly Full Backup**: `pg_basebackup` dijalankan otomatis setiap pukul 02.00 WIB.
3. **MinIO Object Replication**: Sinkronisasi bucket berkas bukti secara bidirectional ke server Disaster Recovery (DR) di lokasi fisik berbeda.

### 13.4 Pemetaan Kepatuhan OWASP ASVS v4.0 Level 2

| ASVS Section | Kontrol Teknis NusaProc |
| :--- | :--- |
| **V1: Architecture** | Modular Monolith dengan isolasi domain, audit trail append-only. |
| **V2: Authentication** | OIDC SSO dengan Google Workspace, rate limiting 5 req/min pada endpoint fallback, TOTP RFC 6238. |
| **V3: Session Mgmt** | Stateless JWT dengan durasi pendek (15 menit) + Redis-backed Refresh Token (7 hari) dengan token revocation. |
| **V4: Access Control** | 5-Layer Security Interceptor, penegakan SoD di level database (SQL CHECK constraints) dan TypeScript application layer. |
| **V5: Cryptography** | Enkripsi AES-256-GCM pada nomor rekening bank pemasok (`pgcrypto`), TLS 1.3 enforced. |
| **V8: Data Protection** | WORM retention pada MinIO, masking nomor rekening pada UI, sanitasi log dari kredensial. |

---

## 14. Verifikasi & Langkah Penerimaan Teknis (M0 Gate)

Dokumen Technical Design ini dinyatakan disahkan jika memenuhi kriteria kelulusan gerbang M0:
1. Skema database PostgreSQL lolos review tim Data/DBA tanpa dependensi siklik.
2. SoD Conflict Matrix disetujui tertulis oleh VP Finance & Internal Audit.
3. Arsitektur runtime Bun (`bun:sql`) dan antarmuka **React + Ant Design** diverifikasi oleh tim Engineering & UI/UX Nusanet.
