import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Issue #48: Responsive Design for Tables, Forms & Mobile Navigation', () => {
  const frontendRoot = join(__dirname, '../../');

  it('AppLayout.tsx implements mobile drawer navigation and hamburger menu button', () => {
    const layoutPath = join(frontendRoot, 'src/components/layout/AppLayout.tsx');
    expect(existsSync(layoutPath)).toBe(true);
    const content = readFileSync(layoutPath, 'utf-8');

    expect(content).toContain('MenuOutlined');
    expect(content).toContain('<Drawer');
    expect(content).toContain('mobileDrawerOpen');
    expect(content).toContain('setMobileDrawerOpen(true)');
  });

  it('PrCreateForm.tsx implements adaptive item layout with useBreakpoint', () => {
    const formPath = join(frontendRoot, 'src/features/pr/components/PrCreateForm.tsx');
    expect(existsSync(formPath)).toBe(true);
    const content = readFileSync(formPath, 'utf-8');

    expect(content).toContain('useBreakpoint');
    expect(content).toContain('isMobile');
    expect(content).toContain('!isMobile');
    expect(content).toContain('Item #{index + 1}');
  });

  it('verifies horizontal scroll prop is configured on all Table components', () => {
    const tableFiles = [
      'src/features/admin/pages/AdminUsersPage.tsx',
      'src/features/admin/pages/AdminOrganizationPage.tsx',
      'src/features/admin/pages/AdminFeedbackPage.tsx',
      'src/features/vendor/pages/VendorListPage.tsx',
      'src/features/pr/pages/PrListPage.tsx',
      'src/features/po/pages/PoListPage.tsx',
      'src/features/receipt/pages/ReceiptListPage.tsx',
      'src/features/receipt/pages/NcrListPage.tsx',
      'src/features/invoice/pages/InvoiceListPage.tsx',
      'src/features/payment/pages/PaymentListPage.tsx',
      'src/features/dashboard/ActionDashboard.tsx',
      'src/features/receipt/components/BastCreateForm.tsx',
      'src/features/invoice/components/TwoWayMatcherScreen.tsx',
    ];

    for (const file of tableFiles) {
      const fullPath = join(frontendRoot, file);
      expect(existsSync(fullPath)).toBe(true);
      const content = readFileSync(fullPath, 'utf-8');
      expect(content).toContain('scroll={{ x:');
    }
  });

  it('verifies responsive maxWidth constraints on large administrative modals', () => {
    const modalFiles = [
      'src/features/admin/pages/AdminUsersPage.tsx',
      'src/features/admin/pages/AdminOrganizationPage.tsx',
    ];

    for (const file of modalFiles) {
      const fullPath = join(frontendRoot, file);
      expect(existsSync(fullPath)).toBe(true);
      const content = readFileSync(fullPath, 'utf-8');
      expect(content).toContain("maxWidth: 'calc(100vw - 32px)'");
    }
  });
});
