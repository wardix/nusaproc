import { withTransaction } from '../../db/client';
import { VendorRepository } from './repository';
import { recordAuditTrailEntry } from '../audit/service';
import { ForbiddenError, NotFoundError } from '../sod/errors';
import {
  createVendorSchema,
  createBankAccountSchema,
  updateVendorStatusSchema,
  type CreateVendorInput,
  type CreateBankAccountInput,
  type VerifyBankAccountInput,
  type UpdateVendorStatusInput,
  type DeleteVendorInput,
  type VendorRecord,
  type VendorBankAccountRecord,
} from './types';

export type {
  CreateVendorInput,
  CreateBankAccountInput,
  VerifyBankAccountInput,
  UpdateVendorStatusInput,
  DeleteVendorInput,
  VendorRecord,
  VendorBankAccountRecord,
};

function generateVendorCode(): string {
  const timeHex = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `VEND-${timeHex}-${randomSuffix}`;
}

export async function createVendor(input: CreateVendorInput): Promise<VendorRecord> {
  const validated = createVendorSchema.parse(input);
  const repo = new VendorRepository();

  return await repo.createVendor({
    id: crypto.randomUUID(),
    vendorCode: generateVendorCode(),
    name: validated.name,
    taxIdentificationNumber: validated.taxIdentificationNumber,
    isPkp: validated.isPkp ?? false,
    status: 'PROSPECTIVE',
    createdBy: input.createdBy,
  });
}

export async function createVendorBankAccount(
  input: CreateBankAccountInput
): Promise<VendorBankAccountRecord> {
  const validated = createBankAccountSchema.parse(input);
  const repo = new VendorRepository();

  const vendor = await repo.findVendorById(input.vendorId);
  if (!vendor) {
    throw new Error(`Vendor dengan ID '${input.vendorId}' tidak ditemukan.`);
  }

  return await repo.createBankAccount({
    id: crypto.randomUUID(),
    vendorId: input.vendorId,
    bankName: validated.bankName,
    bankCode: validated.bankCode,
    accountNumber: validated.accountNumber,
    accountHolderName: validated.accountHolderName,
    status: 'PENDING_VERIFICATION',
  });
}

export async function verifyBankAccountStage(
  input: VerifyBankAccountInput
): Promise<VendorBankAccountRecord> {
  const { bankAccountId, verifierUserId, action, rejectionReason } = input;

  return await withTransaction(async (tx) => {
    const repo = new VendorRepository(tx);
    const account = await repo.findBankAccountById(bankAccountId);

    if (!account) {
      throw new Error(`Rekening bank '${bankAccountId}' tidak ditemukan.`);
    }

    if (action === 'VERIFY_STAGE_1') {
      if (account.status === 'VERIFIED') {
        throw new Error('Rekening bank sudah terverifikasi penuh.');
      }

      return await repo.updateBankAccountVerification({
        id: bankAccountId,
        status: 'PENDING_VERIFICATION',
        verifiedBy1: verifierUserId,
      });
    }

    if (action === 'VERIFY_STAGE_2') {
      if (!account.verifiedBy1) {
        throw new Error('Verifikasi Tahap 1 wajib dilakukan terlebih dahulu sebelum Tahap 2.');
      }

      // R18: 4-Eyes Principle check
      if (account.verifiedBy1 === verifierUserId) {
        throw new Error(
          'Pelanggaran 4-Eyes Principle (R18): Verifikator Tahap 2 wajib orang yang berbeda dari Verifikator Tahap 1.'
        );
      }

      // Temporal pattern (R19): unset previous primary bank account
      await repo.unsetPreviousPrimaryAccounts(account.vendorId, bankAccountId);

      // Verify and set as primary bank account
      const verifiedAccount = await repo.updateBankAccountVerification({
        id: bankAccountId,
        status: 'VERIFIED',
        verifiedBy2: verifierUserId,
        isPrimary: true,
      });

      // Update Vendor status to APPROVED (R17)
      await repo.updateVendorStatus(account.vendorId, 'APPROVED', account.verifiedBy1, verifierUserId);

      return verifiedAccount;
    }

    if (action === 'REJECT') {
      return await repo.updateBankAccountVerification({
        id: bankAccountId,
        status: 'INACTIVE',
        rejectionReason: rejectionReason || null,
        isPrimary: false,
      });
    }

    throw new Error(`Aksi verifikasi '${action}' tidak dikenali.`);
  });
}

export async function getVendorById(id: string): Promise<VendorRecord> {
  const repo = new VendorRepository();
  const vendor = await repo.findVendorById(id);
  if (!vendor) {
    throw new Error(`Vendor '${id}' tidak ditemukan.`);
  }
  return vendor;
}

export async function listVendors(params?: { status?: any; search?: string }): Promise<Array<VendorRecord & { bankAccounts?: VendorBankAccountRecord[] }>> {
  const repo = new VendorRepository();
  return await repo.listVendors(params);
}

export async function listVendorBankAccounts(vendorId: string): Promise<VendorBankAccountRecord[]> {
  const repo = new VendorRepository();
  return await repo.listBankAccountsByVendorId(vendorId);
}

export async function updateVendorStatusService(
  input: UpdateVendorStatusInput
): Promise<VendorRecord> {
  const { vendorId, status, userId, userRole, reason } = input;
  const validated = updateVendorStatusSchema.parse({ status, reason });
  const repo = new VendorRepository();

  const vendor = await repo.findVendorById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor dengan ID '${vendorId}' tidak ditemukan.`);
  }

  const allowedRoles = ['ADMIN', 'ACCOUNT_PAYABLE'];
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError(
      'Hanya pengguna dengan peran ADMIN atau ACCOUNT_PAYABLE yang berhak memperbarui status vendor.'
    );
  }

  const oldStatus = vendor.status;
  const updated = await repo.updateVendorStatus(vendorId, validated.status);

  // Non-blocking audit log
  try {
    await recordAuditTrailEntry({
      actorId: userId,
      actorRole: userRole,
      actionType: 'UPDATE_VENDOR_STATUS',
      entityName: 'vendor',
      entityId: vendorId,
      oldState: { status: oldStatus },
      newState: { status: validated.status },
      ipAddress: '127.0.0.1',
      justification: `Pembaruan status vendor '${vendor.name}' (${vendor.vendorCode}) dari ${oldStatus} menjadi ${validated.status}${validated.reason ? `: ${validated.reason}` : ''}`,
    });
  } catch {
    // Non-blocking
  }

  return updated;
}

export async function deleteVendorService(
  input: DeleteVendorInput
): Promise<{ id: string; name: string }> {
  const { vendorId, userId, userRole } = input;
  const repo = new VendorRepository();

  const vendor = await repo.findVendorById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor dengan ID '${vendorId}' tidak ditemukan.`);
  }

  const allowedRoles = ['ADMIN', 'ACCOUNT_PAYABLE'];
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError(
      'Hanya pengguna dengan peran ADMIN atau ACCOUNT_PAYABLE yang berhak menghapus vendor.'
    );
  }

  const result = await withTransaction(async (tx) => {
    const txRepo = new VendorRepository(tx);
    return await txRepo.deleteVendor(vendorId);
  });

  // Non-blocking audit log
  try {
    await recordAuditTrailEntry({
      actorId: userId,
      actorRole: userRole,
      actionType: 'DELETE_VENDOR',
      entityName: 'vendor',
      entityId: vendorId,
      oldState: { id: vendor.id, vendorCode: vendor.vendorCode, name: vendor.name, status: vendor.status },
      newState: null,
      ipAddress: '127.0.0.1',
      justification: `Penghapusan master vendor '${vendor.name}' (${vendor.vendorCode})`,
    });
  } catch {
    // Non-blocking
  }

  return result;
}

