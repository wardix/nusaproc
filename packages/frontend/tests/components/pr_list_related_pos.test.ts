import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('PR List Page Related POs Display (Option A)', () => {
  const frontendRoot = join(__dirname, '../../');
  const prListPath = join(frontendRoot, 'src/features/pr/pages/PrListPage.tsx');

  it('verifies PrListPage contains the PO Terkait column and related PO chip renderer', () => {
    expect(existsSync(prListPath)).toBe(true);
    const content = readFileSync(prListPath, 'utf-8');

    // Column title and data key
    expect(content).toContain("title: 'PO Terkait'");
    expect(content).toContain("key: 'relatedPos'");

    // Related PO tag rendering and status-based colors
    expect(content).toContain('po.poNumber');
    expect(content).toContain('po.status');
    expect(content).toContain('FileTextOutlined');
    expect(content).toContain('record.relatedPos');

    // Tooltip with details (Vendor, Nilai)
    expect(content).toContain('po.vendorName');
    expect(content).toContain('po.grandTotalAmount');

    // Click navigation to /po
    expect(content).toContain("onClick={() => navigate('/po')}");

    // Smart Action button for partially vs fully ordered PRs
    expect(content).toContain('Terbitkan Sisa PO');
    expect(content).toContain('Selesai (PO Terpenuhi)');
  });
});
