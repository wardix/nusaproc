import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('PR List Page Requester & Date Information Display', () => {
  const frontendRoot = join(__dirname, '../../');
  const prListPath = join(frontendRoot, 'src/features/pr/pages/PrListPage.tsx');

  it('verifies PrListPage contains columns for Tgl Pengajuan and Pemohon (Requester)', () => {
    expect(existsSync(prListPath)).toBe(true);
    const content = readFileSync(prListPath, 'utf-8');

    expect(content).toContain('Tgl Pengajuan');
    expect(content).toContain('Pemohon (Requester)');
    expect(content).toContain('requesterName');
    expect(content).toContain('formatDate');
    expect(content).toContain('scroll={{ x: 1000 }}');
  });
});
