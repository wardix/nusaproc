import { withTransaction } from '../../db/client';
import { PoRepository } from './repository';
import { VendorRepository } from '../vendor/repository';
import {
  createPoSchema,
  type CreatePoInput,
  type AmendPoInput,
  type PoWithDetails,
  type PurchaseOrderRecord,
  type PoAmendmentHistoryRecord,
} from './types';
import { validateSodAction } from '../sod/validator';
import { createPoPdfDocument } from '../../services/pdf';

export type { CreatePoInput, AmendPoInput, PoWithDetails, PurchaseOrderRecord, PoAmendmentHistoryRecord };

function generatePoNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `PO-${dateStr}-${randomSuffix}`;
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<PurchaseOrderRecord> {
  const validated = createPoSchema.parse(input);
  const poId = crypto.randomUUID();
  const poNumber = generatePoNumber();

  let subtotalAmount = 0;
  const itemsToInsert = validated.items.map((item, idx) => {
    const qty = Number(item.quantityOrdered);
    const price = Number(item.unitPrice);
    subtotalAmount += qty * price;

    return {
      id: crypto.randomUUID(),
      poId,
      prItemId: item.prItemId,
      lineNumber: item.lineNumber || idx + 1,
      itemName: item.itemName,
      quantityOrdered: qty,
      uom: item.uom,
      unitPrice: price,
    };
  });

  const taxAmount = Number(validated.taxAmount || 0);
  const grandTotalAmount = subtotalAmount + taxAmount;

  return await withTransaction(async (tx) => {
    const repo = new PoRepository(tx);

    const po = await repo.createPo({
      id: poId,
      poNumber,
      vendorId: validated.vendorId,
      vendorBankAccountId: validated.vendorBankAccountId,
      paymentTermType: validated.paymentTermType,
      status: 'DRAFT',
      subtotalAmount,
      taxAmount,
      grandTotalAmount,
      termsAndConditions: validated.termsAndConditions,
      createdBy: input.createdBy,
    });

    await repo.insertPoItems(itemsToInsert);

    return po;
  });
}

export async function approvePurchaseOrder(poId: string, approverId: string): Promise<PurchaseOrderRecord> {
  const repo = new PoRepository();
  const po = await repo.findPoById(poId);

  if (!po) {
    throw new Error(`Purchase Order '${poId}' tidak ditemukan.`);
  }

  // R25: SoD Enforcement - PO Author cannot approve their own PO
  validateSodAction(approverId, 'APPROVE_PO', { poAuthorId: po.createdBy });

  return await repo.updatePoStatus(poId, po.status, approverId);
}

export async function issuePurchaseOrder(poId: string, _userId: string): Promise<PurchaseOrderRecord> {
  const repo = new PoRepository();
  const vendorRepo = new VendorRepository();

  const po = await repo.findPoById(poId);
  if (!po) {
    throw new Error(`Purchase Order '${poId}' tidak ditemukan.`);
  }

  // R24: Verification Guard - Vendor and Bank Account must be approved / verified
  const vendor = await vendorRepo.findVendorById(po.vendorId);
  if (!vendor || vendor.status !== 'APPROVED') {
    throw new Error(
      `Penerbitan PO ditolak (R24): Vendor '${vendor?.name || po.vendorId}' belum berstatus APPROVED (status saat ini: ${vendor?.status || 'UNKNOWN'}).`
    );
  }

  const bankAccount = await vendorRepo.findBankAccountById(po.vendorBankAccountId);
  if (!bankAccount || bankAccount.status !== 'VERIFIED') {
    throw new Error(
      `Penerbitan PO ditolak (R24): Rekening bank vendor belum berstatus VERIFIED (status saat ini: ${bankAccount?.status || 'UNKNOWN'}).`
    );
  }

  return await repo.updatePoStatus(poId, 'ISSUED', undefined, true);
}

export async function updatePurchaseOrderDirect(
  poId: string,
  fields: Partial<PurchaseOrderRecord>
): Promise<PurchaseOrderRecord> {
  const repo = new PoRepository();
  const po = await repo.findPoById(poId);

  if (!po) {
    throw new Error(`Purchase Order '${poId}' tidak ditemukan.`);
  }

  // R26: Issued PO cannot be edited directly
  if (po.status === 'ISSUED' || po.status === 'AMENDED') {
    throw new Error(
      'PO yang telah terbit (ISSUED) tidak dapat diedit langsung, wajib melalui mekanisme amendemen resmi (R26).'
    );
  }

  return await repo.updatePoDirect(poId, fields);
}

export async function amendPurchaseOrder(input: AmendPoInput): Promise<PoAmendmentHistoryRecord> {
  return await withTransaction(async (tx) => {
    const repo = new PoRepository(tx);
    const po = await repo.findPoById(input.poId);

    if (!po) {
      throw new Error(`Purchase Order '${input.poId}' tidak ditemukan.`);
    }

    if (po.status !== 'ISSUED' && po.status !== 'AMENDED') {
      throw new Error(`Hanya PO yang telah terbit (ISSUED) yang dapat diamendemen. Status saat ini: ${po.status}`);
    }

    const currentSeq = await repo.getMaxAmendmentSequence(input.poId);
    const amendmentNumber = currentSeq + 1;

    const previousSnapshot: Record<string, unknown> = {
      versionNumber: po.versionNumber,
      termsAndConditions: po.termsAndConditions,
      subtotalAmount: po.subtotalAmount,
      taxAmount: po.taxAmount,
      grandTotalAmount: po.grandTotalAmount,
    };

    const history = await repo.createAmendmentHistory({
      id: crypto.randomUUID(),
      poId: input.poId,
      amendmentNumber,
      changeSummary: input.reason,
      previousSnapshot,
      requestedBy: input.requestedById || input.authorizedById,
      approvedBy: input.authorizedById,
    });

    await repo.updatePoDirect(input.poId, {
      termsAndConditions: input.updatedTermsAndConditions || po.termsAndConditions,
      versionNumber: po.versionNumber + 1,
    });

    await repo.updatePoStatus(input.poId, 'AMENDED');

    return history;
  });
}

export async function generatePoPdf(poId: string): Promise<Uint8Array> {
  const repo = new PoRepository();
  const vendorRepo = new VendorRepository();

  const po = await repo.findPoById(poId);
  if (!po) {
    throw new Error(`Purchase Order '${poId}' tidak ditemukan.`);
  }

  const items = await repo.findPoItems(poId);
  const vendor = await vendorRepo.findVendorById(po.vendorId);
  const bankAccount = await vendorRepo.findBankAccountById(po.vendorBankAccountId);

  if (!vendor || !bankAccount) {
    throw new Error('Informasi Vendor atau Rekening Bank tidak lengkap untuk pembuatan PDF PO.');
  }

  return await createPoPdfDocument({ po, items, vendor, bankAccount });
}

export async function getPurchaseOrderById(poId: string): Promise<PoWithDetails> {
  const repo = new PoRepository();
  const po = await repo.findPoById(poId);

  if (!po) {
    throw new Error(`Purchase Order '${poId}' tidak ditemukan.`);
  }

  const items = await repo.findPoItems(poId);
  const amendments = await repo.findAmendmentHistories(poId);

  return {
    ...po,
    items,
    amendments,
  };
}
