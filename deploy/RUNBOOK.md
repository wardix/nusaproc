# 🚀 NusaProc — Production Linux Deployment & Operations Runbook
### Panduan Standar Operasional Deployment Server Linux (Ubuntu/Debian)
**Versi:** 1.0.0 | **Klasifikasi:** Dokumen Operasional IT / DevOps PT Nusanet

---

## 📑 Daftar Isi
1. [Arsitektur Deployment Produksi](#1-arsitektur-deployment-produksi)
2. [Prasyarat Server & Kebutuhan Perangkat Lunak](#2-prasyarat-server--kebutuhan-perangkat-lunak)
3. [Panduan Instalasi & Konfigurasi Bertahap](#3-panduan-instalasi--konfigurasi-bertahap)
   - [Langkah 1: Pembuatan Service User & Direktori Aplikasi](#langkah-1-pembuatan-service-user--direktori-aplikasi)
   - [Langkah 2: Instalasi Runtime Bun & Dependencies](#langkah-2-instalasi-runtime-bun--dependencies)
   - [Langkah 3: Konfigurasi Environment Variable (.env)](#langkah-3-konfigurasi-environment-variable-env)
   - [Langkah 4: Migrasi Basis Data PostgreSQL](#langkah-4-migrasi-basis-data-postgresql)
   - [Langkah 5: Konfigurasi & Aktivasi Systemd Service Unit](#langkah-5-konfigurasi--aktivasi-systemd-service-unit)
   - [Langkah 6: Konfigurasi Nginx Reverse Proxy & SSL TLS (Certbot)](#langkah-6-konfigurasi-nginx-reverse-proxy--ssl-tls-certbot)
4. [Otomasi Deployment & Update Rutin](#4-otomasi-deployment--update-rutin)
5. [Prosedur Pencadangan Basis Data (Database Backup SOP)](#5-prosedur-pencadangan-basis-data-database-backup-sop)
6. [Prosedur Pemulihan Bencana (Disaster Recovery & Rollback)](#6-prosedur-pemulihan-bencana-disaster-recovery--rollback)
7. [Pemantauan Sistem & Log Analysis (Observability)](#7-pemantauan-sistem--log-analysis-observability)

---

## 1. Arsitektur Deployment Produksi

```mermaid
flowchart TD
    Client[Klien Web Browser / Mobile] -->|HTTPS 443| Nginx[Nginx Reverse Proxy & TLS]
    Nginx -->|Static Files SPA| FrontendDist["/opt/nusaproc/packages/frontend/dist"]
    Nginx -->|Proxy /api/ & /health| Backend["Bun HTTP Server (127.0.0.1:8000)"]
    Backend -->|Systemd Managed| SystemdUnit["nusaproc-backend.service"]
    Backend -->|PostgreSQL Protocol 5432| DB[("PostgreSQL Database (nusaproc_db)")]
    Backend -->|Outbox Webhooks| ExtSystems["Sistem ERP & Perbankan Eksternal"]
```

- **Reverse Proxy & Web Server:** Nginx 1.18+ (menangani terminasi SSL/TLS, proteksi HTTP Header, kompresi Gzip, dan hosting SPA).
- **Backend Application Runtime:** Bun 1.1+ (menjalankan API Hono performa tinggi pada port internal `8000`).
- **Service Supervisor:** Systemd Linux Service Unit dengan auto-restart dan isolasi keamanan kernel.
- **Basis Data:** PostgreSQL 15/16 dengan ekstensi `pgcrypto` dan `uuid-ossp`.

---

## 2. Prasyarat Server & Kebutuhan Perangkat Lunak

### Spesifikasi Minimum Server:
- **Sistem Operasi:** Ubuntu 22.04 LTS atau 24.04 LTS (x86_64 / ARM64).
- **CPU:** 2 vCPU Core atau lebih tinggi.
- **RAM:** 4 GB RAM (8 GB direkomendasikan untuk beban tinggi).
- **Disk:** 50 GB NVMe SSD Storage.

### Paket Perangkat Lunak Wajib:
```bash
sudo apt update && sudo apt install -y \
    curl git nginx certbot python3-certbot-nginx \
    postgresql-client unzip jq htop ufw
```

---

## 3. Panduan Instalasi & Konfigurasi Bertahap

### Langkah 1: Pembuatan Service User & Direktori Aplikasi
Demi keamanan (*Principle of Least Privilege*), aplikasi dijalankan menggunakan user dedicated non-root `nusaproc`:

```bash
# 1. Buat user sistem nusaproc
sudo useradd -r -s /bin/false -d /opt/nusaproc nusaproc

# 2. Buat direktori aplikasi dan clone repository
sudo mkdir -p /opt/nusaproc
sudo chown -R nusaproc:nusaproc /opt/nusaproc
sudo -u nusaproc git clone https://github.com/wardix/nusaproc.git /opt/nusaproc
```

---

### Langkah 2: Instalasi Runtime Bun & Dependencies

```bash
# 1. Install Bun secara global
curl -fsSL https://bun.sh/install | bash
sudo cp /root/.bun/bin/bun /usr/local/bin/bun

# 2. Verifikasi instalasi Bun
bun --version

# 3. Install dependencies monorepo
cd /opt/nusaproc
sudo -u nusaproc /usr/local/bin/bun install --frozen-lockfile
```

---

### Langkah 3: Konfigurasi Environment Variable (`.env`)
Salin template konfigurasi dan atur kredensial produksi:

```bash
sudo -u nusaproc nano /opt/nusaproc/.env
```

**Contoh file `.env` produksi:**
```ini
NODE_ENV=production
PORT=8000
DATABASE_URL=postgres://nusaproc_user:StrongRandomPassword123!@127.0.0.1:5432/nusaproc_db?sslmode=disable
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=super-secret-jwt-key-min-64-characters-long-random-string-for-prod-3891048
BANK_ENCRYPTION_KEY=bank-encryption-aes-256-gcm-master-key-prod-091823908
```

Kunci izin akses file:
```bash
sudo chmod 600 /opt/nusaproc/.env
sudo chown nusaproc:nusaproc /opt/nusaproc/.env
```

---

### Langkah 4: Migrasi Basis Data PostgreSQL

```bash
cd /opt/nusaproc
sudo -u nusaproc /usr/local/bin/bun run db:migrate
```

*(Opsional) Untuk inisialisasi data demo awal pada server staging:*
```bash
sudo -u nusaproc /usr/local/bin/bun run db:seed
```

---

### Langkah 5: Konfigurasi & Aktivasi Systemd Service Unit

```bash
# 1. Salin unit file systemd
sudo cp /opt/nusaproc/deploy/systemd/nusaproc-backend.service /etc/systemd/system/

# 2. Reload daemon systemd
sudo systemctl daemon-reload

# 3. Enable dan start service
sudo systemctl enable --now nusaproc-backend.service

# 4. Verifikasi status service
sudo systemctl status nusaproc-backend.service
```

---

### Langkah 6: Konfigurasi Nginx Reverse Proxy & SSL TLS (Certbot)

```bash
# 1. Salin konfigurasi Nginx
sudo cp /opt/nusaproc/deploy/nginx/nusaproc.conf /etc/nginx/sites-available/nusaproc.conf

# 2. Aktifkan virtual host
sudo ln -s /etc/nginx/sites-available/nusaproc.conf /etc/nginx/sites-enabled/

# 3. Uji sintaks konfigurasi Nginx
sudo nginx -t

# 4. Dapatkan sertifikat SSL Let's Encrypt
sudo certbot --nginx -d nusaproc.nusanet.net.id

# 5. Reload Nginx
sudo systemctl reload nginx
```

---

## 4. Otomasi Deployment & Update Rutin

Untuk memperbarui aplikasi ke versi terbaru secara instan dan tanpa downtime berarti, jalankan script deployment otomatis:

```bash
sudo /opt/nusaproc/deploy/scripts/deploy.sh
```

Script ini secara otomatis:
1. Menarik commit terbaru dari branch `main`.
2. Menginstal dependencies baru via `bun install`.
3. Menjalankan migrasi database (`bun run db:migrate`).
4. Mengompilasi frontend SPA (`bun run --cwd packages/frontend build`).
5. Merestart `nusaproc-backend.service`.
6. Melakukan health check otomatis pada endpoint `/health`.

---

## 5. Prosedur Pencadangan Basis Data (Database Backup SOP)

### 1. Skrip Pencadangan Otomatis (`/usr/local/bin/backup-nusaproc-db.sh`):
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nusaproc"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/nusaproc_db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "Memulai backup basis data NusaProc..."
pg_dump -U nusaproc_user -h 127.0.0.1 nusaproc_db | gzip > "${BACKUP_FILE}"

# Hapus backup yang lebih lama dari 30 hari
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +30 -delete

echo "Backup berhasil disimpan di ${BACKUP_FILE}"
```

### 2. Konfigurasi Cron Job (Harian Pukul 02.00 WIB):
```bash
sudo crontab -e
# Tambahkan baris berikut:
0 2 * * * /usr/local/bin/backup-nusaproc-db.sh >> /var/log/nusaproc-backup.log 2>&1
```

---

## 6. Prosedur Pemulihan Bencana (Disaster Recovery & Rollback)

### Prosedur Rollback Versi Aplikasi:
Jika rilis baru mengalami kendala kritis:
```bash
cd /opt/nusaproc
sudo -u nusaproc git checkout <commit-hash-sebelumnya>
sudo -u nusaproc /usr/local/bin/bun install --frozen-lockfile
sudo -u nusaproc /usr/local/bin/bun run --cwd packages/frontend build
sudo systemctl restart nusaproc-backend.service
```

### Prosedur Restore Database dari File Cadangan:
```bash
# 1. Hentikan service backend sementara
sudo systemctl stop nusaproc-backend.service

# 2. Restore file cadangan
gunzip -c /var/backups/nusaproc/nusaproc_db_YYYYMMDD_HHMMSS.sql.gz | psql -U nusaproc_user -h 127.0.0.1 -d nusaproc_db

# 3. Jalankan kembali service backend
sudo systemctl start nusaproc-backend.service
```

---

## 7. Pemantauan Sistem & Log Analysis (Observability)

### Memeriksa Log Backend Real-Time:
```bash
sudo journalctl -u nusaproc-backend.service -f -n 100
```

### Memeriksa Log Akses & Error Nginx:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Pemeriksaan Kesehatan Server (Health Probe):
```bash
curl -i http://127.0.0.1:8000/health
```
Respons yang diharapkan:
```json
{
  "status": "ok",
  "service": "nusaproc-backend",
  "timestamp": "2026-08-24T00:10:00.000Z"
}
```
