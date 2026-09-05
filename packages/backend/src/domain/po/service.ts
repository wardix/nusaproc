import { withTransaction } from '../../db/client';
import { PoRepository } from './repository';
import { PrRepository } from '../pr/repository';
import { VendorRepository, ensureDefaultVendors } from '../vendor/repository';
import {
  createPoSchema,
  updatePoSchema,
  type CreatePoInput,
  type UpdatePoInput,
  type AmendPoInput,
  type PoWithDetails,
  type PurchaseOrderRecord,
  type PoAmendmentHistoryRecord,
} from './types';
import { validateSodAction } from '../sod/validator';
import { createPoPdfDocument } from '../../services/pdf';
import { recordAuditTrailEntry } from '../audit/service';

export type { CreatePoInput, UpdatePoInput, AmendPoInput, PoWithDetails, PurchaseOrderRecord, PoAmendmentHistoryRecord };

function generatePoNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `PO-${dateStr}-${randomSuffix}`;
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<PurchaseOrderRecord> {
  const validated = createPoSchema.parse(input);
  const poId = crypto.randomUUID();
  const poNumber = generatePoNumber();

  const vendorRepo = new VendorRepository();
  let vendor = await vendorRepo.findVendorById(validated.vendorId);
  if (!vendor) {
    await ensureDefaultVendors();
    vendor = await vendorRepo.findVendorById(validated.vendorId);
  }
  if (!vendor) {
    throw new Error(
      `Vendor dengan ID '${validated.vendorId}' tidak ditemukan dalam sistem.`
    );
  }
  if (vendor.status === 'BLACKLISTED') {
    throw new Error(
      `Pembuatan PO ditolak (R65): Vendor '${vendor.name}' berstatus BLACKLISTED.`
    );
  }

  let bankAccount = await vendorRepo.findBankAccountById(validated.vendorBankAccountId);
  if (!bankAccount) {
    await ensureDefaultVendors();
    bankAccount = await vendorRepo.findBankAccountById(validated.vendorBankAccountId);
  }
  if (!bankAccount) {
    throw new Error(
      `Rekening bank vendor dengan ID '${validated.vendorBankAccountId}' tidak ditemukan.`
    );
  }
  if (bankAccount.vendorId !== validated.vendorId) {
    throw new Error(
      `Rekening bank yang dipilih tidak terdaftar untuk vendor '${vendor.name}'.`
    );
  }

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
    const prRepo = new PrRepository(tx);

    // Validate PR item status & remaining quantity, then increment quantity_ordered
    for (const item of validated.items) {
      const prItem = await prRepo.findItemById(item.prItemId);
      if (prItem) {
        const pr = await prRepo.findById(prItem.prId);
        if (pr && pr.status !== 'APPROVED') {
          throw new Error(
            `Pembuatan PO ditolak (R24): Purchase Request '${pr.prNumber}' belum berstatus APPROVED (status saat ini: ${pr.status}).`
          );
        }

        const remaining = Number(prItem.quantityRequested) - Number(prItem.quantityOrdered);
        if (Number(item.quantityOrdered) > remaining) {
          throw new Error(
            `Pembuatan PO ditolak: Kuantitas pesanan item '${prItem.itemName}' (${item.quantityOrdered} ${item.uom}) melebihi sisa kuantitas PR yang belum dipesan (${Math.max(0, remaining)} ${item.uom}).`
          );
        }

        await prRepo.incrementItemQuantityOrdered(prItem.id, Number(item.quantityOrdered));
      }
    }

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

  // R24 & R65: Verification Guard & Blacklist Guard
  const vendor = await vendorRepo.findVendorById(po.vendorId);
  if (!vendor || vendor.status !== 'APPROVED') {
    throw new Error(
      `Penerbitan PO ditolak (R24/R65): Vendor '${vendor?.name || po.vendorId}' belum berstatus APPROVED (status saat ini: ${vendor?.status || 'UNKNOWN'}).`
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
  if (po.status === 'ISSUED' || po.status === 'AMENDED' || po.status === 'COMPLETED' || po.status === 'CANCELLED') {
    throw new Error(
      'PO yang telah terbit (ISSUED) tidak dapat diedit langsung, wajib melalui mekanisme amendemen resmi (R26).'
    );
  }

  return await repo.updatePoDirect(poId, fields);
}

export async function updatePurchaseOrder(input: UpdatePoInput): Promise<PoWithDetails> {
  const validated = updatePoSchema.parse(input);
  const poId = input.poId;

  return await withTransaction(async (tx) => {
    const repo = new PoRepository(tx);
    const prRepo = new PrRepository(tx);
    const vendorRepo = new VendorRepository(tx);

    const po = await repo.findPoById(poId);
    if (!po) {
      throw new Error(`Purchase Order '${poId}' tidak ditemukan.`);
    }

    // R26: Issued PO cannot be edited directly
    if (po.status === 'ISSUED' || po.status === 'AMENDED' || po.status === 'COMPLETED' || po.status === 'CANCELLED') {
      throw new Error(
        'PO yang telah terbit (ISSUED) tidak dapat diedit langsung, wajib melalui mekanisme amendemen resmi (R26).'
      );
    }

    const targetVendorId = validated.vendorId || po.vendorId;
    const targetBankAccountId = validated.vendorBankAccountId || po.vendorBankAccountId;

    let vendor = await vendorRepo.findVendorById(targetVendorId);
    if (!vendor) {
      await ensureDefaultVendors();
      vendor = await vendorRepo.findVendorById(targetVendorId);
    }
    if (!vendor) {
      throw new Error(`Vendor dengan ID '${targetVendorId}' tidak ditemukan dalam sistem.`);
    }
    if (vendor.status === 'BLACKLISTED') {
      throw new Error(`Perubahan PO ditolak (R65): Vendor '${vendor.name}' berstatus BLACKLISTED.`);
    }

    let bankAccount = await vendorRepo.findBankAccountById(targetBankAccountId);
    if (!bankAccount) {
      await ensureDefaultVendors();
      bankAccount = await vendorRepo.findBankAccountById(targetBankAccountId);
    }
    if (!bankAccount) {
      throw new Error(`Rekening bank vendor dengan ID '${targetBankAccountId}' tidak ditemukan.`);
    }
    if (bankAccount.vendorId !== targetVendorId) {
      throw new Error(`Rekening bank yang dipilih tidak terdaftar untuk vendor '${vendor.name}'.`);
    }

    let subtotalAmount = po.subtotalAmount;
    let taxAmount = validated.taxAmount !== undefined ? Number(validated.taxAmount) : po.taxAmount;

    // If items are provided, recalculate fulfillment and update po_items
    if (validated.items && validated.items.length > 0) {
      const existingItems = await repo.findPoItems(poId);
      const oldQtyByPrItemId = new Map<string, number>();
      for (const item of existingItems) {
        const current = oldQtyByPrItemId.get(item.prItemId) || 0;
        oldQtyByPrItemId.set(item.prItemId, current + Number(item.quantityOrdered));
      }

      const newQtyByPrItemId = new Map<string, number>();
      for (const item of validated.items) {
        const current = newQtyByPrItemId.get(item.prItemId) || 0;
        newQtyByPrItemId.set(item.prItemId, current + Number(item.quantityOrdered));
      }

      // Check each new item against PR remaining quantity
      for (const [prItemId, newQty] of newQtyByPrItemId.entries()) {
        const prItem = await prRepo.findItemById(prItemId);
        if (!prItem) {
          throw new Error(`PR Item '${prItemId}' tidak ditemukan.`);
        }
        const pr = await prRepo.findById(prItem.prId);
        if (pr && pr.status !== 'APPROVED') {
          throw new Error(`Revisi PO ditolak: Purchase Request '${pr.prNumber}' belum berstatus APPROVED.`);
        }

        const oldQty = oldQtyByPrItemId.get(prItemId) || 0;
        const remaining = Number(prItem.quantityRequested) - Number(prItem.quantityOrdered) + oldQty;
        if (newQty > remaining) {
          throw new Error(
            `Revisi PO ditolak: Kuantitas pesanan item '${prItem.itemName}' (${newQty} ${prItem.uom}) melebihi sisa kuantitas PR yang tersedia (${Math.max(0, remaining)} ${prItem.uom}).`
          );
        }

        const delta = newQty - oldQty;
        if (delta !== 0) {
          await prRepo.incrementItemQuantityOrdered(prItemId, delta);
        }
      }

      // Any PR item that was in old but not in new: restore quantity
      for (const [prItemId, oldQty] of oldQtyByPrItemId.entries()) {
        if (!newQtyByPrItemId.has(prItemId)) {
          await prRepo.incrementItemQuantityOrdered(prItemId, -oldQty);
        }
      }

      await repo.deletePoItems(poId);

      subtotalAmount = 0;
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

      await repo.insertPoItems(itemsToInsert);
    }

    const grandTotalAmount = subtotalAmount + taxAmount;

    // Reset approval when vendor, items, terms, or amounts are revised
    await repo.updatePoDraft(poId, {
      vendorId: targetVendorId,
      vendorBankAccountId: targetBankAccountId,
      paymentTermType: validated.paymentTermType || po.paymentTermType,
      termsAndConditions: validated.termsAndConditions !== undefined ? validated.termsAndConditions : po.termsAndConditions,
      subtotalAmount,
      taxAmount,
      grandTotalAmount,
      resetApproval: true,
    });

    // Record Audit Trail
    try {
      await recordAuditTrailEntry({
        actorId: input.userId,
        actorRole: input.userRole || 'ACCOUNT_PAYABLE',
        actionType: 'PO_UPDATED',
        entityName: 'purchase_order',
        entityId: poId,
        oldState: {
          vendorId: po.vendorId,
          vendorName: po.vendorName,
          vendorBankAccountId: po.vendorBankAccountId,
          paymentTermType: po.paymentTermType,
          grandTotalAmount: po.grandTotalAmount,
          status: po.status,
          approvedBy: po.approvedBy,
        },
        newState: {
          vendorId: targetVendorId,
          vendorName: vendor.name,
          vendorBankAccountId: targetBankAccountId,
          paymentTermType: validated.paymentTermType || po.paymentTermType,
          grandTotalAmount,
          status: 'DRAFT',
          approvedBy: null,
        },
        justification: input.reason || 'Perubahan Vendor / Spesifikasi PO sebelum persetujuan (Pre-Approval Revision)',
        ipAddress: input.ipAddress || '127.0.0.1',
        userAgent: input.userAgent || 'NusaProc-Internal',
      });
    } catch {
      // Non-blocking audit log
    }

    const updatedPo = await repo.findPoById(poId);
    const updatedItems = await repo.findPoItems(poId);
    const amendments = await repo.findAmendmentHistories(poId);

    return {
      ...(updatedPo as PurchaseOrderRecord),
      items: updatedItems,
      amendments,
    };
  });
}

export async function amendPurchaseOrder(input: AmendPoInput): Promise<PoAmendmentHistoryRecord> {
  return await withTransaction(async (tx) => {
    const repo = new PoRepository(tx);
    const vendorRepo = new VendorRepository(tx);

    const po = await repo.findPoById(input.poId);
    if (!po) {
      throw new Error(`Purchase Order '${input.poId}' tidak ditemukan.`);
    }

    // R65: Vendor Blacklist guard on amendment
    const vendor = await vendorRepo.findVendorById(po.vendorId);
    if (vendor && vendor.status === 'BLACKLISTED') {
      throw new Error(
        `Amendemen PO ditolak (R65): Vendor '${vendor.name}' berstatus BLACKLISTED.`
      );
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

export async function listPurchaseOrders(params?: { status?: string }): Promise<PurchaseOrderRecord[]> {
  const repo = new PoRepository();
  return await repo.listPurchaseOrders(params);
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
