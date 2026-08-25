# NusaProc — Nusanet Enterprise Procurement System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/Runtime-Bun%201.1%2B-black?logo=bun)](https://bun.sh)
[![Backend](https://img.shields.io/badge/Backend-TypeScript%20%7C%20Raw%20SQL-blue?logo=typescript)](https://www.typescriptlang.org)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org)
[![Tests](https://img.shields.io/badge/Tests-163%20Passing%20(100%25)-success)](packages/backend/tests)

Sistem pengadaan barang dan jasa internal terintegrasi untuk **PT Media Antar Nusa (Nusanet)**. NusaProc menggantikan proses pengadaan manual (chat, email, spreadsheet) menjadi satu *single source of truth* dengan penegakan kepatuhan otomatis, *Separation of Duties (SoD)* 5-lapis, pencegahan *fraud*, verifikasi rekening bank 4-Mata, pencocokan invoice otomatis (*2-Way Matching Engine*), alur pembayaran *Maker-Checker-Executor*, jejak audit kriptografis berantai (*SHA-256 Hash Chaining*), dan kalkulasi pajak presisi (Dual-NSFP & Coretax).

---

## 📌 Indeks Dokumentasi

| Dokumen | Deskripsi | Tautan |
|---|---|---|
| 📋 **Product Requirements (PRD)** | 65 kebutuhan terperinci (R1–R65), matriks SoD, dan *Acceptance Criteria* konkret | [`prd.md`](prd.md) |
| 🔧 **Technical Design (TDD)** | Arsitektur *Zero-ORM*, skema DDL PostgreSQL 16, 5-layer SoD engine, dan arsitektur UI | [`tdd.md`](tdd.md) |
| 📖 **User Manual & SOP 7 Peran** | Panduan operasional langkah-demi-langkah untuk seluruh pengguna & persona PT Nusanet | [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) |
| 📊 **Business Rules Cheat Sheet** | Rangkuman cepat matriks SoD, aturan NSFP lama vs Coretax, dan formula toleransi 2-Way Matcher | [`docs/BUSINESS_RULES_CHEAT_SHEET.md`](docs/BUSINESS_RULES_CHEAT_SHEET.md) |
| 🌐 **Interactive OpenAPI / Swagger UI** | Dokumentasi interaktif REST API NusaProc untuk integrasi sistem ERP, HR, dan perbankan | [**`/api/docs`**](http://localhost:3000/api/docs) |
| 🚀 **Production Linux Runbook** | Panduan instalasi server, *systemd service*, konfigurasi Nginx, dan SOP backup PostgreSQL | [`deploy/RUNBOOK.md`](deploy/RUNBOOK.md) |

---

## 🏗️ Arsitektur & Monorepo Layout

NusaProc dibangun menggunakan arsitektur **Modular Monolith** berbasis TypeScript dan Bun:

```mermaid
flowchart LR
    subgraph CLIENT["Frontend (React 18 + Ant Design v5)"]
        UI["Ant Design (antd v5)\nTanStack Query v5 + Zustand\nIndonesian Locale (id_ID)"]
    end

    subgraph GATEWAY["Reverse Proxy / Web Server"]
        NGINX["Nginx Load Balancer\nTLS 1.3, HSTS, Gzip, Security Headers"]
    end

    subgraph SERVER["Backend (Bun Runtime)"]
        HONO["Hono / Bun.serve Router\nDomain Modules (PR, PO, Receipt, Invoice, Payment, Audit)"]
        SQL_CLIENT["Built-in Bun SQL (bun:sql)\nZero ORM, Raw Parameterized SQL"]
    end

    subgraph STORAGE["Persistence Tier"]
        PG[("PostgreSQL 16\nUUIDv7, JSONB Snapshots\nImmutable Audit Trail")]
    end

    CLIENT --> GATEWAY --> SERVER
    SERVER --> SQL_CLIENT --> PG
```

### Struktur Direktori

```text
nusaproc/
├── packages/
│   ├── backend/          # REST API (Hono + Bun), Zero-ORM SQL services, Background Workers
│   │   ├── src/          # Domain modules (auth, pr, po, vendor, receipt, invoice, payment, audit, storage)
│   │   └── tests/        # 145 unit, domain, integration, dan E2E test suites
│   ├── frontend/         # React 18 + Vite + Ant Design v5 SPA (Dashboard, PR, PO, Matcher, Payment, Audit)
│   └── shared/           # Tipe data TypeScript, konstanta persona demo, dan enum bersama
├── deploy/               # Konfigurasi deployment produksi Linux
│   ├── nginx/            # Template konfigurasi Nginx reverse proxy + SSL
│   ├── systemd/          # Berkas unit systemd service untuk Bun backend
│   ├── scripts/          # Skrip deployment otomatis zero-downtime (deploy.sh)
│   └── RUNBOOK.md        # Panduan operasional & pemulihan bencana produksi
├── docs/                 # Panduan Pengguna (User Manual) & Business Rules Cheat Sheet
├── prd.md                # Product Requirements Document
├── tdd.md                # Technical Design Document
└── package.json          # Root workspace scripts (dev, test, db:migrate, db:seed)
```

---

## ⚡ Fitur Utama & Kepatuhan Bisnis

1. **5-Layer Security & Separation of Duties (`R1–R5`, `R15`, `R25`, `R31`, `R42`)**:
   - Mencegah *Self-Approval* (Pembuat PR/PO dilarang menyetujui dokumen sendiri).
   - Menegakkan pemisahan penerima fisik barang (Gudang) vs pembuat PO (`R31`).
   - Menerapkan alur pembayaran 3-tingkat terpisah: **Maker (Pengusul)** $\rightarrow$ **Checker (Pemeriksa)** $\rightarrow$ **Executor (Pelaksana transfer)**.
2. **Verifikasi Rekening Bank 4-Mata & Gembok PO (`R17–R24`)**:
   - Rekening bank vendor wajib diverifikasi oleh 2 orang berbeda (Staff AP & Head of AP) sebelum PO dapat diterbitkan.
   - Pola rekening bank temporal (*Temporal Bank Pattern*) mengunci riwayat rekening tanpa menghapus data historis.
3. **Penerimaan Barang (BAST) & Unggah Invoice Simultan (`R28–R31`)**:
   - Pencatatan fisik barang disertai *inspection notes* dan unggahan invoice/faktur pajak vendor secara bersamaan.
   - Tiket NCR (*Non-Conformance Report*) otomatis terbentuk saat terdapat barang rusak/ditolak.
4. **2-Way Matching Engine & Dual-NSFP (`R33–R40`)**:
   - Komparasi otomatis antara PO dan Invoice dengan indikator toleransi *traffic light*:
     - **Hijau**: Nilai 100% cocok.
     - **Kuning**: Selisih dalam ambang batas toleransi ($\le 1.0\%$ atau $\le \text{Rp } 100.000$).
     - **Merah**: Melebihi batas, status pembayaran invoice otomatis ditahan (*Hold*).
   - Override pengecualian hanya dapat dilakukan oleh Head of AP dengan memo tertulis wajib (`R39`).
5. **Autentikasi Ulang Berjenjang & Idempotensi Pembayaran (`R5`, `R43`)**:
   - Eksekusi transfer wajib menyertakan token *Step-Up Re-Authentication* (`X-Reauth-Token`) dan *Idempotency-Key* untuk menjamin keamanan dari eksekusi ganda (*double payment*).
6. **Jejak Audit Kriptografis Berantai & Sandbox Auditor (`R51–R55`)**:
   - Setiap mutasi log audit terikat dalam rantai hash SHA-256 (*Hash Chaining*).
   - Akun *Auditor* dikunci dalam *read-only sandbox* (hanya metode HTTP `GET`) dan dapat mengunduh bundel bukti kepatuhan hukum berformat ZIP.

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat Sistem
- [Bun](https://bun.sh) (v1.1.0 atau lebih baru)
- [PostgreSQL](https://www.postgresql.org) (v16+)

### 2. Instalasi Dependensi
```bash
# Clone repository
git clone git@github.com:wardix/nusaproc.git
cd nusaproc

# Install seluruh workspace dependencies
bun install
```

### 3. Konfigurasi Lingkungan (`.env`)
Buat berkas `.env` di root direktori project:
```env
DATABASE_URL=postgres://nusaproc_user:your_secure_password@localhost:5432/nusaproc_db
PORT=3000
NODE_ENV=development
JWT_SECRET=super-secret-dev-jwt-key-min-32-chars-long
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./uploads
```

### 4. Eksekusi Migrasi & Data Seeder
```bash
# Menjalankan migrasi DDL database PostgreSQL 16
bun run db:migrate

# Mengisi 8 persona demo PT Nusanet & transaksi contoh
bun run db:seed
```

### 5. Menjalankan Server Pengembangan Lokal
```bash
# Menjalankan Backend API (:3000) dan Frontend Web (:5173) sekaligus
bun run dev
```
- Buka antarmuka web di: [**`http://localhost:5173`**](http://localhost:5173)
- Buka dokumentasi Swagger UI di: [**`http://localhost:3000/api/docs`**](http://localhost:3000/api/docs)

---

## 👥 Akun Demo Bawaan PT Nusanet (Seeded Personas)

Sistem dilengkapi dengan 8 persona demo realistis. Anda dapat beralih peran secara instan menggunakan **Fast Persona Switcher Bar** di bagian atas aplikasi web:

| Persona | Departemen / Jabatan | Peran Aktif (*Role*) | Email Akun | Password Demo |
|---|---|---|---|---|
| **Budi Santoso** | Network Operations Staff | `REQUESTER` | `budi.santoso@nusanet.net.id` | `Password123!` |
| **Siti Aminah** | Head of Network Operations | `APPROVER` | `siti.aminah@nusanet.net.id` | `Password123!` |
| **Dewi Lestari** | Account Payable Staff | `ACCOUNT_PAYABLE` (Maker) | `dewi.lestari@nusanet.net.id` | `Password123!` |
| **Hendra Wijaya** | Head of Account Payable | `ACCOUNT_PAYABLE` (Checker) | `hendra.wijaya@nusanet.net.id` | `Password123!` |
| **Joko Susilo** | Central Warehouse Lead | `WAREHOUSE` | `joko.susilo@nusanet.net.id` | `Password123!` |
| **Rina Kartika** | Finance & Treasury Lead | `FINANCE` | `rina.kartika@nusanet.net.id` | `Password123!` |
| **Agus Setiawan** | Internal Audit Lead | `AUDITOR` | `agus.setiawan@nusanet.net.id` | `Password123!` |
| **Admin Pengadaan** | IT System Administrator | `ADMIN` | `admin@nusanet.net.id` | `Password123!` |

---

## 🧪 Pengujian & Kualitas Kode

NusaProc menerapkan protokol **Test-Driven Development (TDD)** yang ketat:

```bash
# Menjalankan seluruh 163 test suites (Unit, Domain, Integration, E2E)
bun test

# Pengecekan tipe data TypeScript statis
bun run typecheck

# Pengecekan linter ESLint
bun run lint

# Kompilasi production bundle frontend
bun run --cwd packages/frontend build
```

---

## 🌐 Deployment Produksi Linux

Untuk menerapkan NusaProc pada server produksi Linux (Ubuntu 22.04 / 24.04 LTS) tanpa Docker:
1. Ikuti petunjuk lengkap pada [**`deploy/RUNBOOK.md`**](deploy/RUNBOOK.md).
2. Salin berkas unit `deploy/systemd/nusaproc-backend.service` ke `/etc/systemd/system/`.
3. Salin konfigurasi `deploy/nginx/nusaproc.conf` ke `/etc/nginx/sites-available/`.
4. Jalankan skrip rilis otomatis:
   ```bash
   bash deploy/scripts/deploy.sh
   ```

---

## 📄 Lisensi
Hak Cipta © 2026 **PT Media Antar Nusa (Nusanet)**. Seluruh hak cipta dilindungi undang-undang. Berlisensi di bawah [MIT License](LICENSE).
