import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('Epic 18: Production Linux Deployment Configuration (Systemd, Nginx & Hardening)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');

  it('validates systemd service unit configuration file', () => {
    const servicePath = path.join(rootDir, 'deploy/systemd/nusaproc-backend.service');
    expect(existsSync(servicePath)).toBe(true);

    const content = readFileSync(servicePath, 'utf-8');
    expect(content).toContain('[Unit]');
    expect(content).toContain('[Service]');
    expect(content).toContain('[Install]');
    expect(content).toContain('ExecStart=');
    expect(content).toContain('bun');
    expect(content).toContain('Restart=always');
    expect(content).toContain('NoNewPrivileges=true');
    expect(content).toContain('ProtectSystem=full');
    expect(content).toContain('LimitNOFILE=65535');
  });

  it('validates Nginx reverse proxy and security configuration', () => {
    const nginxPath = path.join(rootDir, 'deploy/nginx/nusaproc.conf');
    expect(existsSync(nginxPath)).toBe(true);

    const content = readFileSync(nginxPath, 'utf-8');
    expect(content).toContain('upstream nusaproc_backend');
    expect(content).toContain('server 127.0.0.1:8000');
    expect(content).toContain('proxy_pass http://nusaproc_backend');
    expect(content).toContain('Strict-Transport-Security');
    expect(content).toContain('X-Content-Type-Options');
    expect(content).toContain('X-Frame-Options');
    expect(content).toContain('Content-Security-Policy');
    expect(content).toContain('gzip on;');
    expect(content).toContain('try_files $uri $uri/ /index.html;');
  });

  it('validates automated deployment script', () => {
    const deployScriptPath = path.join(rootDir, 'deploy/scripts/deploy.sh');
    expect(existsSync(deployScriptPath)).toBe(true);

    const content = readFileSync(deployScriptPath, 'utf-8');
    expect(content).toContain('#!/usr/bin/env bash');
    expect(content).toContain('bun install');
    expect(content).toContain('db:migrate');
    expect(content).toContain('packages/frontend build');
    expect(content).toContain('systemctl restart');
    expect(content).toContain('/health');
  });

  it('validates comprehensive production operations runbook', () => {
    const runbookPath = path.join(rootDir, 'deploy/RUNBOOK.md');
    expect(existsSync(runbookPath)).toBe(true);

    const content = readFileSync(runbookPath, 'utf-8');
    expect(content).toContain('Arsitektur Deployment');
    expect(content).toContain('Instalasi & Konfigurasi');
    expect(content).toContain('Database Backup SOP');
    expect(content).toContain('Disaster Recovery');
    expect(content).toContain('Observability');
  });
});
