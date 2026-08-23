import { withTransaction } from '../../db/client';
import { ReceiptRepository } from './repository';
import { PoRepository } from '../po/repository';
import { InvoiceRepository } from '../invoice/repository';
import { validateSodAction } from '../sod/validator';
import {
  recordGoodsReceiptSchema,
  type RecordGoodsReceiptInput,
  type ReceiptWithDetails,
  type GoodsReceiptRecord,
  type NonConformanceReportRecord,
} from './types';

export type { RecordGoodsReceiptInput, ReceiptWithDetails, GoodsReceiptRecord, NonConformanceReportRecord };

function generateGrNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `GR-${dateStr}-${randomSuffix}`;
}

function generateNcrNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `NCR-${dateStr}-${randomSuffix}`;
}

function generateInternalInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `INV-INT-${dateStr}-${randomSuffix}`;
}

export async function recordGoodsReceipt(input: RecordGoodsReceiptInput): Promise<ReceiptWithDetails> {
  const validated = recordGoodsReceiptSchema.parse(input);

  return await withTransaction(async (tx) => {
    const poRepo = new PoRepository(tx);
    const receiptRepo = new ReceiptRepository(tx);
    const invoiceRepo = new InvoiceRepository(tx);

    const po = await poRepo.findPoById(validated.poId);
    if (!po) {
      throw new Error(`Purchase Order '${validated.poId}' tidak ditemukan.`);
    }

    if (po.status !== 'ISSUED' && po.status !== 'AMENDED' && po.status !== 'COMPLETED') {
      throw new Error(
        `Penerimaan barang hanya dapat dilakukan untuk PO yang telah diterbitkan (ISSUED). Status saat ini: ${po.status}`
      );
    }

    // R31: SoD Enforcement - Receiver cannot be PO Author or PO Approver
    validateSodAction(validated.receivedBy, 'RECEIVE_GOODS', {
      poAuthorId: po.createdBy,
      poApproverId: po.approvedBy || undefined,
    });

    const poItems = await poRepo.findPoItems(validated.poId);
    const poItemMap = new Map(poItems.map((item) => [item.id, item]));

    // Validate quantities
    for (const item of validated.items) {
      const poItem = poItemMap.get(item.poItemId);
      if (!poItem) {
        throw new Error(`PO Item '${item.poItemId}' tidak ditemukan pada Purchase Order '${po.poNumber}'.`);
      }

      const remainingQty = poItem.quantityOrdered - poItem.quantityReceived;
      if (item.quantityReceived > remainingQty) {
        throw new Error(
          `Kuantitas penerimaan (${item.quantityReceived} ${poItem.uom}) melebihi sisa pesanan PO (${remainingQty} ${poItem.uom}) untuk item '${poItem.itemName}'.`
        );
      }
    }

    const grId = crypto.randomUUID();
    const grNumber = generateGrNumber();

    const gr = await receiptRepo.createGoodsReceipt({
      id: grId,
      grNumber,
      poId: validated.poId,
      receiptType: validated.receiptType,
      deliveryNoteNumber: validated.deliveryNoteNumber,
      receivedDate: validated.receivedDate,
      receivedBy: validated.receivedBy,
      notes: validated.notes,
    });

    const itemsToInsert = validated.items.map((item) => ({
      id: crypto.randomUUID(),
      grId,
      poItemId: item.poItemId,
      quantityReceived: item.quantityReceived,
      quantityRejected: item.quantityRejected ?? 0,
      conditionNotes: item.conditionNotes,
    }));

    const insertedItems = await receiptRepo.insertGoodsReceiptItems(itemsToInsert);

    // Update PO items quantity_received
    for (const item of validated.items) {
      if (item.quantityReceived > 0) {
        await receiptRepo.incrementPoItemReceivedQuantity(item.poItemId, item.quantityReceived);
      }
    }

    // R30: Automatic NCR Report when quantity_rejected > 0
    const ncrRecords: NonConformanceReportRecord[] = [];
    for (const item of validated.items) {
      if (item.quantityRejected && item.quantityRejected > 0) {
        const poItem = poItemMap.get(item.poItemId);
        const itemName = poItem?.itemName || 'Item PO';
        const ncr = await receiptRepo.createNonConformanceReport({
          id: crypto.randomUUID(),
          ncrNumber: generateNcrNumber(),
          grId,
          poId: validated.poId,
          description:
            item.conditionNotes ||
            `Terdapat ${item.quantityRejected} unit ${itemName} yang rusak/ditolak pada penerimaan ${grNumber}.`,
          actionRequired: 'Penggantian barang / retur atau perbaikan garansi dari vendor',
        });
        ncrRecords.push(ncr);
      }
    }

    // R29: Simultaneous Vendor Invoice Upload
    let linkedInvoiceId: string | undefined;
    if (validated.invoice) {
      const invInput = validated.invoice;
      const invoiceId = crypto.randomUUID();
      const invoice = await invoiceRepo.createInvoice({
        id: invoiceId,
        invoiceNumberInternal: generateInternalInvoiceNumber(),
        vendorInvoiceNumber: invInput.vendorInvoiceNumber,
        vendorId: po.vendorId,
        poId: po.id,
        grId,
        invoiceDate: invInput.invoiceDate,
        dueDate: invInput.dueDate,
        subtotalAmount: invInput.subtotalAmount,
        ppnAmount: invInput.ppnAmount,
        pphAmount: invInput.pphAmount,
        totalPayableAmount: invInput.totalPayableAmount,
        nsfpOriginal: invInput.nsfpOriginal,
        taxSnapshotId: invInput.taxSnapshotId,
        uploadedBy: validated.receivedBy,
      });
      linkedInvoiceId = invoice.id;
    }

    // Check if PO is completely received
    const updatedPoItems = await poRepo.findPoItems(validated.poId);
    const isFullyReceived = updatedPoItems.every(
      (item) => item.quantityReceived >= item.quantityOrdered
    );
    if (isFullyReceived) {
      await poRepo.updatePoStatus(po.id, 'COMPLETED');
    }

    return {
      ...gr,
      items: insertedItems,
      ncrRecords,
      linkedInvoiceId,
    };
  });
}

export async function getGoodsReceiptById(id: string): Promise<ReceiptWithDetails> {
  const repo = new ReceiptRepository();
  const gr = await repo.findGoodsReceiptById(id);
  if (!gr) {
    throw new Error(`Goods Receipt '${id}' tidak ditemukan.`);
  }

  const items = await repo.findGoodsReceiptItems(id);
  const ncrRecords = await repo.findNcrsByGrId(id);
  const invoice = await repo.findInvoiceByGrId(id);

  return {
    ...gr,
    items,
    ncrRecords,
    linkedInvoiceId: invoice?.id,
  };
}

export async function listGoodsReceipts(filters?: { poId?: string; limit?: number }): Promise<GoodsReceiptRecord[]> {
  const repo = new ReceiptRepository();
  return await repo.listGoodsReceipts(filters);
}

export async function listNcrs(filters?: { poId?: string; isResolved?: boolean }): Promise<NonConformanceReportRecord[]> {
  const repo = new ReceiptRepository();
  return await repo.listNcrs(filters);
}
