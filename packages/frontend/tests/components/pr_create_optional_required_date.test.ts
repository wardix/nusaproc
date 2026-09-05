import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('PR Create Form Optional Required Date Field', () => {
  const frontendRoot = join(__dirname, '../../');
  const prFormPath = join(frontendRoot, 'src/features/pr/components/PrCreateForm.tsx');

  it('verifies requiredDate in PrCreateForm is marked optional and has no mandatory rule', () => {
    expect(existsSync(prFormPath)).toBe(true);
    const content = readFileSync(prFormPath, 'utf-8');

    expect(content).toContain('Tanggal Kebutuhan / Deadline (Opsional)');
    expect(content).not.toContain('name="requiredDate"\n                label="Tanggal Kebutuhan / Deadline"\n                rules={[{ required: true');
  });
});
