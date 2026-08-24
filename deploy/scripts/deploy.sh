#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# NusaProc Production Deployment & Automated Update Script
# Target: Ubuntu 22.04 / 24.04 LTS (Debian-based Linux)
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/nusaproc}"
SERVICE_NAME="nusaproc-backend.service"

echo "======================================================================"
echo "🚀 Starting NusaProc Production Deployment at $(date -u '+%Y-%m-%d %H:%M:%SZ')"
echo "📁 Application Directory: ${APP_DIR}"
echo "======================================================================"

cd "${APP_DIR}"

# 1. Fetch latest changes from Git
echo "[1/6] 📥 Pulling latest release from Git origin/main..."
if [ -d ".git" ]; then
    git fetch origin main
    git reset --hard origin/main
else
    echo "⚠️  Not a git repository, skipping git pull."
fi

# 2. Install / Update Monorepo Dependencies
echo "[2/6] 📦 Installing dependencies with Bun..."
bun install --frozen-lockfile

# 3. Execute Database Migrations
echo "[3/6] 🗄️  Running PostgreSQL schema migrations..."
bun run db:migrate

# 4. Build Production Frontend Bundle
echo "[4/6] 🏗️  Building React Single Page Application (SPA)..."
bun run --cwd packages/frontend build

# 5. Restart Systemd Backend Service
echo "[5/6] 🔄 Restarting systemd service: ${SERVICE_NAME}..."
if command -v systemctl &> /dev/null; then
    sudo systemctl daemon-reload
    sudo systemctl restart "${SERVICE_NAME}"
    sudo systemctl is-active --quiet "${SERVICE_NAME}" && echo "✅ Service ${SERVICE_NAME} is active and running!" || (echo "❌ Service failed to start" && exit 1)
else
    echo "⚠️  systemctl not found in container/environment, skipping service restart."
fi

# 6. Verify Backend Health Check
echo "[6/6] 🩺 Verifying backend health check endpoint..."
HEALTH_URL="http://127.0.0.1:8000/health"
RETRIES=10
DELAY=2
PASSED=false

for i in $(seq 1 $RETRIES); do
    if curl -s -f "${HEALTH_URL}" > /dev/null; then
        PASSED=true
        break
    fi
    echo "Waiting for backend to respond... (Attempt $i/$RETRIES)"
    sleep $DELAY
done

if [ "$PASSED" = true ]; then
    echo "======================================================================"
    echo "✨ NusaProc Production Deployment Completed Successfully! ✨"
    echo "======================================================================"
else
    echo "❌ Health check failed after $RETRIES attempts at ${HEALTH_URL}"
    exit 1
fi
