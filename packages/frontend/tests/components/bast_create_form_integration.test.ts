import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('BAST & Two-Way Matcher Form Backend Integration', () => {
  const frontendRoot = join(__dirname, '../../');
  const bastFormPath = join(frontendRoot, 'src/features/receipt/components/BastCreateForm.tsx');
  const matcherPath = join(frontendRoot, 'src/features/invoice/components/TwoWayMatcherScreen.tsx');

  it('verifies BastCreateForm file exists and calls receiptApi.create', () => {
    expect(existsSync(bastFormPath)).toBe(true);
    const content = readFileSync(bastFormPath, 'utf-8');

    expect(content).toContain('receiptApi.create(payload)');
    expect(content).toContain('poApi');
    expect(content).toContain('getById');
    expect(content).toContain('loading={submitting}');
    expect(content).toContain('scroll={{ x: 600 }}');
  });

  it('verifies TwoWayMatcherScreen calls invoiceApi.overrideException', () => {
    expect(existsSync(matcherPath)).toBe(true);
    const content = readFileSync(matcherPath, 'utf-8');

    expect(content).toContain('invoiceApi.overrideException(');
    expect(content).toContain('submittingOverride');
    expect(content).toContain('confirmLoading={submittingOverride}');
  });
});
