# NusaProc — Nusanet Procurement System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/Runtime-Bun%201.1%2B-black?logo=bun)](https://bun.sh)
[![Backend](https://img.shields.io/badge/Backend-TypeScript%20%7C%20Raw%20SQL-blue?logo=typescript)](https://www.typescriptlang.org)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Ant%20Design%20v5-0170FE?logo=antdesign)](https://ant.design)

Sistem pengadaan barang dan jasa internal terintegrasi untuk **PT Media Antar Nusa (Nusanet)**. NusaProc menggantikan proses pengadaan manual (chat, email, spreadsheet) menjadi satu *single source of truth* dengan penegakan kepatuhan, *Separation of Duties (SoD)* otomatis, pencegahan *fraud*, audit trail kriptografis, dan kalkulasi pajak presisi.

---

## 📌 Dokumentasi Utama

* 📋 [**Product Requirements Document (PRD)**](prd.md): 65 kebutuhan terperinci (R1–R65), 7 persona (DEC-032), dan Acceptance Criteria konkret.
* 🔧 [**Technical Design Document (TDD)**](tdd.md): Desain arsitektur lengkap, DDL database PostgreSQL, 5-layer SoD engine, REST API & Webhook specs, dan arsitektur UI Ant Design.

---

## 🏗️ Arsitektur & Tech Stack

```mermaid
flowchart LR
    subgraph CLIENT["Frontend (SPA)"]
        FE["React 18 + Vite\nAnt Design (antd v5)\nTanStack Query + Zustand"]
    end

    subgraph PROXY["Reverse Proxy"]
        GW["Nginx Load Balancer\nTLS 1.3, Rate Limit"]
    end

    subgraph SERVER["Backend (Bun Runtime)"]
        APP["Modular Monolith\n(TypeScript on Bun 1.1+)\nHono / Bun.serve Router"]
        SQL["Built-in Bun SQL (bun:sql)\nRaw Parameterized SQL, Zero ORM"]
    end

    subgraph STORAGE["Persistence Tier"]
        PG[("PostgreSQL 16\n(UUIDv7, JSONB Snapshots)")]
        REDIS[("Redis 7.2\n(Idempotency & Queues)")]
        MINIO[("MinIO Cluster\n(WORM 10-Yr Storage)")]
    end

    CLIENT --> PROXY --> SERVER
    SERVER --> SQL --> PG
    SERVER --> REDIS
    SERVER --> MINIO
```

### Komponen Kunci
* **Backend**: TypeScript dieksekusi di runtime **Bun (v1.1+)** dengan router **Hono / Bun.serve**.
* **Database Access**: **Built-in Bun SQL (`bun:sql`)** menggunakan **Raw Parameterized SQL** (Zero ORM) untuk performa instan dan pencegahan SQL Injection bawaan.
* **Database**: **PostgreSQL 16** dengan Primary Key `UUIDv7`, tipe data moneter `NUMERIC(18,2)`, dan audit trail append-only.
* **Frontend**: **React 18 + Vite** dengan design system **Ant Design (antd v5)** dan lokalitas Bahasa Indonesia (`id_ID`).
* **Object Storage**: **MinIO** On-Premise dengan kebijakan retensi WORM 10 tahun (UU KUP Pasal 28).
* **Keamanan & Kontrol**: Penegakan 5-layer security interceptor (*Auth $\rightarrow$ RBAC $\rightarrow$ SoD Matrix $\rightarrow$ Scope/Delegation $\rightarrow$ Step-Up Re-auth*).

---

## 🔄 Alur Inti Pengadaan

```
Permintaan (PR) ➔ Persetujuan Berjenjang ➔ Sourcing & PO ➔ Penerimaan (BAST) + Upload Invoice ➔ 2-Way Matching ➔ Persetujuan Bayar ➔ Eksekusi Pembayaran ➔ Penilaian Pemasok
```

1. **Purchase Request (PR)**: Multi-item dengan penanda cara bayar wajib ("Bayar Dimuka/COD" vs "Bayar Setelah Terima"). Tanpa jalur revisi (PR ditolak wajib buat baru).
2. **Purchase Order (PO)**: Terbit hanya jika vendor lolos verifikasi rekening bank ganda (*4-eyes principle*). Pembuat PO dilarang menyetujui PO yang sama.
3. **Goods Receipt (BAST)**: Penerimaan barang/jasa langsung disertai unggahan invoice vendor.
4. **2-Way Matching Engine**: Komparasi otomatis baris PO vs Invoice dengan batas toleransi selisih $\le 1\%$ atau $\le \text{Rp } 100.000$.
5. **Maker-Checker-Executor Payment**: Tiga orang terpisah untuk mengajukan, memeriksa, dan mentransfer dana, dilengkapi *idempotency lock* bebas transfer ganda.

---

## 🚀 Memulai Pengembangan (Quick Start)

### Prasyarat
- [Bun](https://bun.sh) (v1.1.0 atau lebih baru)
- [PostgreSQL](https://www.postgresql.org) (v16+)
- [Redis](https://redis.io) (v7.2+)

### Instalasi & Setup

```bash
# Clone repository
git clone git@github.com:wardix/nusaproc.git
cd nusaproc

# Jalankan test suite dengan Bun (TDD Protocol)
bun test
```

---

## 📄 Lisensi
Hak Cipta © 2026 PT Media Antar Nusa (Nusanet). Berlisensi di bawah [MIT License](LICENSE).
