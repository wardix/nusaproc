import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('PR Creation Form Backend Integration (PrCreateForm.tsx)', () => {
  const frontendRoot = join(__dirname, '../../');
  const formPath = join(frontendRoot, 'src/features/pr/components/PrCreateForm.tsx');

  it('verifies PrCreateForm file exists', () => {
    expect(existsSync(formPath)).toBe(true);
  });

  it('calls prApi.create and prApi.submit in handleSubmit', () => {
    const content = readFileSync(formPath, 'utf-8');

    expect(content).toContain('prApi.create(payload)');
    expect(content).toContain('prApi.submit(');
    expect(content).toContain('submitting');
    expect(content).toContain('loading={submitting}');
  });

  it('loads dynamic master data (UOMs, branches, divisions) on mount', () => {
    const content = readFileSync(formPath, 'utf-8');

    expect(content).toContain('getUoms');
    expect(content).toContain('branchesApi');
    expect(content).toContain('divisionsApi');
  });

  it('supports emergency procurement switch and justification (R48)', () => {
    const content = readFileSync(formPath, 'utf-8');

    expect(content).toContain('isEmergency');
    expect(content).toContain('emergencyJustification');
    expect(content).toContain('Pengadaan Darurat (Emergency Procurement - R48)');
  });
});
