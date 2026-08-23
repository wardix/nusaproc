import { apiClient } from '../client';

export interface CreateVendorPayload {
  vendorCode?: string;
  name: string;
  taxIdentificationNumber: string;
  isPkp?: boolean;
}

export interface CreateBankAccountPayload {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
}

export const vendorApi = {
  create: (data: CreateVendorPayload) =>
    apiClient.post('/vendors', data).then((res) => res.data),

  createBankAccount: (vendorId: string, data: CreateBankAccountPayload) =>
    apiClient.post(`/vendors/${vendorId}/bank-accounts`, data).then((res) => res.data),

  verifyBankAccount: (
    vendorId: string,
    bankId: string,
    data: { action: 'VERIFY_STAGE_1' | 'VERIFY_STAGE_2' | 'REJECT'; rejectionReason?: string }
  ) =>
    apiClient.post(`/vendors/${vendorId}/bank-accounts/${bankId}/verify`, data).then((res) => res.data),
};
