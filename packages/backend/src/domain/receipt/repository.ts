import { sql, type TransactionClient } from '../../db/client';
import type {
  GoodsReceiptRecord,
  GoodsReceiptItemRecord,
  NonConformanceReportRecord,
  ReceiptType,
} from './types';

export class ReceiptRepository {
  constructor(private db: TransactionClient = sql) {}

  async createGoodsReceipt(gr: {
    id: string;
    grNumber: string;
    poId: string;
    receiptType: ReceiptType;
    deliveryNoteNumber?: string | null;
    receivedDate: string;
    receivedBy: string;
    notes?: string | null;
  }): Promise<GoodsReceiptRecord> {
    const rows = await this.db`
      INSERT INTO goods_receipt (
        id, gr_number, po_id, receipt_type,
        delivery_note_number, received_date, received_by, notes
      ) VALUES (
        ${gr.id}, ${gr.grNumber}, ${gr.poId}, ${gr.receiptType},
        ${gr.deliveryNoteNumber ?? null}, ${gr.receivedDate}, ${gr.receivedBy}, ${gr.notes ?? null}
      )
      RETURNING
        id, gr_number AS "grNumber", po_id AS "poId", receipt_type AS "receiptType",
        delivery_note_number AS "deliveryNoteNumber", received_date::text AS "receivedDate",
        received_by AS "receivedBy", notes, created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as GoodsReceiptRecord;
  }

  async insertGoodsReceiptItems(items: Array<{
    id: string;
    grId: string;
    poItemId: string;
    quantityReceived: number;
    quantityRejected: number;
    conditionNotes?: string | null;
  }>): Promise<GoodsReceiptItemRecord[]> {
    const results: GoodsReceiptItemRecord[] = [];

    for (const item of items) {
      const rows = await this.db`
        INSERT INTO goods_receipt_item (
          id, gr_id, po_item_id, quantity_received, quantity_rejected, condition_notes
        ) VALUES (
          ${item.id}, ${item.grId}, ${item.poItemId},
          ${item.quantityReceived}, ${item.quantityRejected}, ${item.conditionNotes ?? null}
        )
        RETURNING
          id, gr_id AS "grId", po_item_id AS "poItemId",
          quantity_received::float AS "quantityReceived",
          quantity_rejected::float AS "quantityRejected",
          condition_notes AS "conditionNotes"
      `;
      results.push(rows[0] as unknown as GoodsReceiptItemRecord);
    }

    return results;
  }

  async incrementPoItemReceivedQuantity(poItemId: string, qtyReceived: number): Promise<void> {
    await this.db`
      UPDATE purchase_order_item
      SET quantity_received = quantity_received + ${qtyReceived}
      WHERE id = ${poItemId}
    `;
  }

  async createNonConformanceReport(ncr: {
    id: string;
    ncrNumber: string;
    grId: string;
    poId: string;
    description: string;
    actionRequired: string;
  }): Promise<NonConformanceReportRecord> {
    const rows = await this.db`
      INSERT INTO non_conformance_report (
        id, ncr_number, gr_id, po_id, description, action_required, is_resolved
      ) VALUES (
        ${ncr.id}, ${ncr.ncrNumber}, ${ncr.grId}, ${ncr.poId},
        ${ncr.description}, ${ncr.actionRequired}, FALSE
      )
      RETURNING
        id, ncr_number AS "ncrNumber", gr_id AS "grId", po_id AS "poId",
        description, action_required AS "actionRequired", is_resolved AS "isResolved",
        resolved_by AS "resolvedBy", resolved_at::text AS "resolvedAt",
        created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as NonConformanceReportRecord;
  }

  async findGoodsReceiptById(id: string): Promise<GoodsReceiptRecord | null> {
    const rows = await this.db`
      SELECT 
        id, gr_number AS "grNumber", po_id AS "poId", receipt_type AS "receiptType",
        delivery_note_number AS "deliveryNoteNumber", received_date::text AS "receivedDate",
        received_by AS "receivedBy", notes, created_at::text AS "createdAt"
      FROM goods_receipt
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as GoodsReceiptRecord) : null;
  }

  async findGoodsReceiptItems(grId: string): Promise<GoodsReceiptItemRecord[]> {
    const rows = await this.db`
      SELECT 
        id, gr_id AS "grId", po_item_id AS "poItemId",
        quantity_received::float AS "quantityReceived",
        quantity_rejected::float AS "quantityRejected",
        condition_notes AS "conditionNotes"
      FROM goods_receipt_item
      WHERE gr_id = ${grId}
    `;

    return rows as unknown as GoodsReceiptItemRecord[];
  }

  async findNcrsByGrId(grId: string): Promise<NonConformanceReportRecord[]> {
    const rows = await this.db`
      SELECT 
        id, ncr_number AS "ncrNumber", gr_id AS "grId", po_id AS "poId",
        description, action_required AS "actionRequired", is_resolved AS "isResolved",
        resolved_by AS "resolvedBy", resolved_at::text AS "resolvedAt",
        created_at::text AS "createdAt"
      FROM non_conformance_report
      WHERE gr_id = ${grId}
    `;

    return rows as unknown as NonConformanceReportRecord[];
  }

  async findInvoiceByGrId(grId: string): Promise<{ id: string } | null> {
    const rows = await this.db`
      SELECT id FROM invoice WHERE gr_id = ${grId} LIMIT 1
    `;
    return rows.length > 0 ? rows[0] : null;
  }

  async listGoodsReceipts(filters?: { poId?: string; limit?: number; offset?: number }): Promise<GoodsReceiptRecord[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let query = sql`
      SELECT 
        id, gr_number AS "grNumber", po_id AS "poId", receipt_type AS "receiptType",
        delivery_note_number AS "deliveryNoteNumber", received_date::text AS "receivedDate",
        received_by AS "receivedBy", notes, created_at::text AS "createdAt"
      FROM goods_receipt
      WHERE 1=1
    `;

    if (filters?.poId) {
      query = sql`${query} AND po_id = ${filters.poId}`;
    }

    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = await query;
    return rows as unknown as GoodsReceiptRecord[];
  }

  async listNcrs(filters?: { poId?: string; isResolved?: boolean; limit?: number }): Promise<NonConformanceReportRecord[]> {
    const limit = filters?.limit || 50;
    let query = sql`
      SELECT 
        id, ncr_number AS "ncrNumber", gr_id AS "grId", po_id AS "poId",
        description, action_required AS "actionRequired", is_resolved AS "isResolved",
        resolved_by AS "resolvedBy", resolved_at::text AS "resolvedAt",
        created_at::text AS "createdAt"
      FROM non_conformance_report
      WHERE 1=1
    `;

    if (filters?.poId) {
      query = sql`${query} AND po_id = ${filters.poId}`;
    }
    if (filters?.isResolved !== undefined) {
      query = sql`${query} AND is_resolved = ${filters.isResolved}`;
    }

    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit}`;
    const rows = await query;
    return rows as unknown as NonConformanceReportRecord[];
  }
}
