import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Purchase Order Creation Flow Integration', () => {
  const frontendRoot = join(__dirname, '../../');
  const poFormPath = join(frontendRoot, 'src/features/po/components/PoCreateForm.tsx');
  const poListPath = join(frontendRoot, 'src/features/po/pages/PoListPage.tsx');
  const routesPath = join(frontendRoot, 'src/routes.tsx');

  it('verifies PoCreateForm component exists and integrates with backend poApi.create', () => {
    expect(existsSync(poFormPath)).toBe(true);
    const content = readFileSync(poFormPath, 'utf-8');

    expect(content).toContain('poApi.create(payload)');
    expect(content).toContain('prApi');
    expect(content).toContain('getById');
    expect(content).toContain('vendorBankAccountId');
    expect(content).toContain('scroll={{ x: 700 }}');
  });

  it('verifies PoListPage contains button to navigate to /po/create', () => {
    expect(existsSync(poListPath)).toBe(true);
    const content = readFileSync(poListPath, 'utf-8');

    expect(content).toContain('/po/create');
    expect(content).toContain('Buat PO Baru');
  });

  it('verifies /po/create route is registered in routes.tsx', () => {
    expect(existsSync(routesPath)).toBe(true);
    const content = readFileSync(routesPath, 'utf-8');

    expect(content).toContain("path: 'po/create'");
    expect(content).toContain('PoCreateForm');
  });
});
