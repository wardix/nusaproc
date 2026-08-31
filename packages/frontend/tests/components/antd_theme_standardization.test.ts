import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Issue #45: Ant Design v5 Token Standardization & Hardcoded Styles Cleanup', () => {
  const frontendRoot = join(__dirname, '../../');

  it('index.html loads Google Fonts Inter stylesheet and preconnect', () => {
    const htmlPath = join(frontendRoot, 'index.html');
    expect(existsSync(htmlPath)).toBe(true);
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    expect(htmlContent).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(htmlContent).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
  });

  it('App.tsx configures Ant Design theme tokens and wraps with AntdApp', () => {
    const appPath = join(frontendRoot, 'src/App.tsx');
    expect(existsSync(appPath)).toBe(true);
    const appContent = readFileSync(appPath, 'utf-8');
    expect(appContent).toContain("colorPrimary: '#0052CC'");
    expect(appContent).toContain("fontFamily: 'Inter");
    expect(appContent).toContain('<AntdApp>');
    expect(appContent).toContain('</AntdApp>');
  });

  it('verifies no static message/notification imports from antd across src', () => {
    const filesToCheck = [
      'src/components/feedback/FeedbackWidget.tsx',
      'src/features/pr/pages/PrListPage.tsx',
      'src/features/po/pages/PoListPage.tsx',
      'src/features/receipt/pages/ReceiptListPage.tsx',
      'src/features/invoice/pages/InvoiceListPage.tsx',
      'src/features/payment/pages/PaymentListPage.tsx',
      'src/features/audit/pages/AuditLogPage.tsx',
      'src/features/admin/pages/AdminUsersPage.tsx',
      'src/features/admin/pages/AdminOrganizationPage.tsx',
      'src/features/admin/pages/AdminFeedbackPage.tsx',
      'src/features/vendor/pages/VendorListPage.tsx',
    ];

    for (const file of filesToCheck) {
      const fullPath = join(frontendRoot, file);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf-8');
        expect(content).not.toMatch(/import\s*\{[^}]*\b(message|notification)\b[^}]*\}\s*from\s*['"]antd['"]/);
      }
    }
  });

  it('verifies primary buttons do not have hardcoded background overrides', () => {
    const filesToCheck = [
      'src/components/feedback/FeedbackWidget.tsx',
      'src/features/admin/pages/AdminUsersPage.tsx',
      'src/features/admin/pages/AdminOrganizationPage.tsx',
      'src/features/admin/pages/AdminFeedbackPage.tsx',
      'src/features/auth/pages/LoginPage.tsx',
    ];

    for (const file of filesToCheck) {
      const fullPath = join(frontendRoot, file);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf-8');
        expect(content).not.toContain("style={{ background: '#0052CC', borderColor: '#0052CC' }}");
        expect(content).not.toContain("style={{ backgroundColor: '#0052CC', borderColor: '#0052CC' }}");
        expect(content).not.toContain("style={{ background: '#0052CC' }}");
      }
    }
  });
});
