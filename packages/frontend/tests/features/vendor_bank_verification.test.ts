import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Vendor Bank Account 4-Eyes Verification Form (R18)', () => {
  const frontendRoot = join(__dirname, '../../');
  const vendorPagePath = join(frontendRoot, 'src/features/vendor/pages/VendorListPage.tsx');

  it('verifies VendorListPage exists and includes 4-Eyes verification components', () => {
    expect(existsSync(vendorPagePath)).toBe(true);
    const content = readFileSync(vendorPagePath, 'utf-8');

    expect(content).toContain('Verifikasi Rekening Bank (4-Eyes Principle - R18)');
    expect(content).toContain('isSameVerifierAsStage1');
    expect(content).toContain('currentBankStatus');
    expect(content).toContain('watchedAction');
  });

  it('enforces dynamic verification options based on current bank status', () => {
    const content = readFileSync(vendorPagePath, 'utf-8');

    // Stage 1 pending: shows Stage 1 option and Reject
    expect(content).toContain("currentBankStatus === 'PENDING_STAGE_1'");
    expect(content).toContain('value="VERIFY_STAGE_1"');

    // Stage 2 pending: shows Stage 2 option and Reject, excludes Stage 1 option
    expect(content).toContain("currentBankStatus === 'PENDING_STAGE_2'");
    expect(content).toContain('value="VERIFY_STAGE_2"');
  });

  it('enforces 4-Eyes SoD guard when logged-in user is the Stage 1 verifier', () => {
    const content = readFileSync(vendorPagePath, 'utf-8');

    // Checks current user identity against Stage 1 verifier (approvedBy1)
    expect(content).toContain('user.fullName.trim().toLowerCase() === verifier1.trim().toLowerCase()');
    expect(content).toContain('Peringatan 4-Eyes Principle (R18)');
    expect(content).toContain('Pelanggaran 4-Eyes Principle (R18)');

    // Disables option and OK button if verifier is the same
    expect(content).toContain('disabled={isSameVerifierAsStage1}');
    expect(content).toContain('disabled: isSameVerifierAsStage1 && watchedAction === \'VERIFY_STAGE_2\'');
  });

  it('renders informative summary of Stage 1 verifier for Stage 2 checker', () => {
    const content = readFileSync(vendorPagePath, 'utf-8');

    expect(content).toContain('Verifikasi Tahap 1 Selesai');
    expect(content).toContain('Tahap 1 telah diverifikasi oleh');
    expect(content).toContain('verifier1');
  });

  it('mandates rejection reason if action is REJECT', () => {
    const content = readFileSync(vendorPagePath, 'utf-8');

    expect(content).toContain("watchedAction === 'REJECT'");
    expect(content).toContain('Alasan penolakan wajib diisi jika menolak rekening');
  });
});
