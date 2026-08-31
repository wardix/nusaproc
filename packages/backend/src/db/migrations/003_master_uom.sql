-- ============================================================================
-- Migration 003: Master Unit of Measure (UOM / Satuan)
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_uom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Index for searching and listing active units
CREATE INDEX IF NOT EXISTS idx_master_uom_active ON master_uom(is_active);
CREATE INDEX IF NOT EXISTS idx_master_uom_name ON master_uom(name);

-- Seed standard initial units
INSERT INTO master_uom (code, name) VALUES
    ('UNIT', 'Unit'),
    ('PCS', 'Pcs'),
    ('BULAN', 'Bulan'),
    ('TAHUN', 'Tahun'),
    ('METER', 'Meter'),
    ('KG', 'Kg'),
    ('PACK', 'Pack'),
    ('BOX', 'Box'),
    ('RIM', 'Rim'),
    ('ROLL', 'Roll'),
    ('SET', 'Set'),
    ('LOT', 'Lot'),
    ('LISENSI', 'Lisensi')
ON CONFLICT (code) DO NOTHING;
