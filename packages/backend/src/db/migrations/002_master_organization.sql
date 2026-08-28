-- ============================================================================
-- NusaProc Migration 002: Dynamic Master Data for Branch Offices and Divisions
-- Rujukan: Issue #43 | PRD Bagian 4.2 (US12) | PRD Bagian 7.1 (R1, R2)
-- ============================================================================

-- 1. Master Branch Table
CREATE TABLE IF NOT EXISTS master_branch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_master_branch_code ON master_branch(code);
CREATE INDEX IF NOT EXISTS idx_master_branch_active ON master_branch(is_active);

-- 2. Master Division Table
CREATE TABLE IF NOT EXISTS master_division (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_master_division_code ON master_division(code);
CREATE INDEX IF NOT EXISTS idx_master_division_active ON master_division(is_active);

-- 3. Seed Initial PT Nusanet Branches
INSERT INTO master_branch (code, name, city, address, is_active) VALUES
    ('HQ_MEDAN', 'Kantor Pusat Medan', 'Medan', 'Jl. Iskandar Muda No. 9, Medan, Sumatera Utara', TRUE),
    ('BRANCH-JKT-01', 'Kantor Cabang Jakarta', 'Jakarta', 'Cyber 2 Tower Lt. 18, Jl. HR Rasuna Said, Jakarta Selatan', TRUE),
    ('BRANCH-SBY-01', 'Kantor Cabang Surabaya', 'Surabaya', 'Intiland Tower Lt. 5, Jl. Panglima Sudirman, Surabaya', TRUE),
    ('BRANCH-BDG-01', 'Kantor Cabang Bandung', 'Bandung', 'Wisma Monex Lt. 9, Jl. Asia Afrika No. 133, Bandung', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    address = EXCLUDED.address,
    is_active = EXCLUDED.is_active,
    updated_at = clock_timestamp();

-- 4. Seed Initial PT Nusanet Divisions
INSERT INTO master_division (code, name, description, is_active) VALUES
    ('DIV-IT', 'Divisi Teknologi Informasi & Infrastruktur', 'Bertanggung jawab atas infrastruktur server, jaringan backbone, dan sistem internal', TRUE),
    ('DIV-OPS', 'Divisi Operasional & Jaringan', 'Bertanggung jawab atas pemeliharaan fiber optik, BTS, POP, dan instalasi pelanggan', TRUE),
    ('DIV-FIN', 'Divisi Keuangan & Akuntansi', 'Bertanggung jawab atas pembukuan, hutang usaha (AP), pembayaran, dan perpajakan', TRUE),
    ('DIV-LOG', 'Divisi Logistik & Pengadaan', 'Bertanggung jawab atas pengadaan barang, manajemen gudang, dan distribusi', TRUE),
    ('DIV-GEN', 'Divisi Umum & Sumber Daya Manusia', 'Bertanggung jawab atas fasilitas kantor, perizinan, dan administrasi umum', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = clock_timestamp();
