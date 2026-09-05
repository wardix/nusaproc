import { describe, it, expect } from 'bun:test';
import { createApp } from '../../../src/index';

describe('PO Creation & Error Handling Integration', () => {
  const app = createApp();

  it('verifies GET /api/v1/vendors returns approved vendor list', async () => {
    const res = await app.request('/api/v1/vendors', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('returns clean 400/404 Problem Details when creating PO with non-existent vendor ID instead of 500', async () => {
    const res = await app.request('/api/v1/purchase-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'c9059686-da98-4daa-aa13-120b0c76ba50',
      },
      body: JSON.stringify({
        vendorId: '99999999-9999-9999-9999-999999999999',
        vendorBankAccountId: '30000000-0000-0000-0000-000000000001',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        taxAmount: 110000,
        termsAndConditions: 'Standar syarat dan ketentuan',
        items: [
          {
            prItemId: '41000000-0000-0000-0000-000000000001',
            lineNumber: 1,
            itemName: 'Switch 24 Port',
            quantityOrdered: 1,
            uom: 'Unit',
            unitPrice: 1000000,
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.status).toBe(400);
    expect(json.detail).toContain('tidak ditemukan');
  });
});
