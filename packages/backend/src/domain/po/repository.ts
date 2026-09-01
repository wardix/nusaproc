import { sql, type TransactionClient } from '../../db/client';
import type {
  PurchaseOrderRecord,
  PurchaseOrderItemRecord,
  PoAmendmentHistoryRecord,
  PoStatus,
} from './types';

export class PoRepository {
  constructor(private db: TransactionClient = sql) {}

  async createPo(po: {
    id: string;
    poNumber: string;
    vendorId: string;
    vendorBankAccountId: string;
    paymentTermType: string;
    status: PoStatus;
    subtotalAmount: number;
    taxAmount: number;
    grandTotalAmount: number;
    termsAndConditions: string;
    createdBy: string;
  }): Promise<PurchaseOrderRecord> {
    const rows = await this.db`
      INSERT INTO purchase_order (
        id, po_number, vendor_id, vendor_bank_account_id,
        payment_term_type, status, subtotal_amount, tax_amount, grand_total_amount,
        terms_and_conditions, created_by
      ) VALUES (
        ${po.id}, ${po.poNumber}, ${po.vendorId}, ${po.vendorBankAccountId},
        ${po.paymentTermType}, ${po.status}, ${po.subtotalAmount}, ${po.taxAmount}, ${po.grandTotalAmount},
        ${po.termsAndConditions}, ${po.createdBy}
      )
      RETURNING
        id, po_number AS "poNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId", payment_term_type AS "paymentTermType",
        version_number AS "versionNumber", status,
        subtotal_amount::float AS "subtotalAmount", tax_amount::float AS "taxAmount",
        grand_total_amount::float AS "grandTotalAmount",
        terms_and_conditions AS "termsAndConditions",
        created_by AS "createdBy", approved_by AS "approvedBy",
        approved_at::text AS "approvedAt", issued_at::text AS "issuedAt",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as PurchaseOrderRecord;
  }

  async insertPoItems(items: Array<{
    id: string;
    poId: string;
    prItemId: string;
    lineNumber: number;
    itemName: string;
    quantityOrdered: number;
    uom: string;
    unitPrice: number;
  }>): Promise<PurchaseOrderItemRecord[]> {
    const results: PurchaseOrderItemRecord[] = [];

    for (const item of items) {
      const rows = await this.db`
        INSERT INTO purchase_order_item (
          id, po_id, pr_item_id, line_number, item_name,
          quantity_ordered, uom, unit_price
        ) VALUES (
          ${item.id}, ${item.poId}, ${item.prItemId}, ${item.lineNumber},
          ${item.itemName}, ${item.quantityOrdered},
          ${item.uom}, ${item.unitPrice}
        )
        RETURNING
          id, po_id AS "poId", pr_item_id AS "prItemId", line_number AS "lineNumber",
          item_name AS "itemName",
          quantity_ordered::float AS "quantityOrdered",
          quantity_received::float AS "quantityReceived",
          quantity_invoiced::float AS "quantityInvoiced",
          uom, unit_price::float AS "unitPrice", subtotal::float AS "subtotal"
      `;
      results.push(rows[0] as unknown as PurchaseOrderItemRecord);
    }

    return results;
  }

  async listPurchaseOrders(params?: { status?: string }): Promise<PurchaseOrderRecord[]> {
    const rows = await this.db`
      SELECT 
        po.id, po.po_number AS "poNumber", po.vendor_id AS "vendorId",
        v.name AS "vendorName",
        po.vendor_bank_account_id AS "vendorBankAccountId", po.payment_term_type AS "paymentTermType",
        po.version_number AS "versionNumber", po.status,
        po.subtotal_amount::float AS "subtotalAmount", po.tax_amount::float AS "taxAmount",
        po.grand_total_amount::float AS "grandTotalAmount",
        po.terms_and_conditions AS "termsAndConditions",
        po.created_by AS "createdBy", po.approved_by AS "approvedBy",
        po.approved_at::text AS "approvedAt", po.issued_at::text AS "issuedAt",
        po.created_at::text AS "createdAt", po.updated_at::text AS "updatedAt"
      FROM purchase_order po
      LEFT JOIN vendor v ON v.id = po.vendor_id
      WHERE 1=1
      ${params?.status ? sql`AND po.status = ${params.status}` : sql``}
      ORDER BY po.created_at DESC
    `;

    return rows as unknown as PurchaseOrderRecord[];
  }

  async findPoById(id: string): Promise<PurchaseOrderRecord | null> {
    const rows = await this.db`
      SELECT 
        id, po_number AS "poNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId", payment_term_type AS "paymentTermType",
        version_number AS "versionNumber", status,
        subtotal_amount::float AS "subtotalAmount", tax_amount::float AS "taxAmount",
        grand_total_amount::float AS "grandTotalAmount",
        terms_and_conditions AS "termsAndConditions",
        created_by AS "createdBy", approved_by AS "approvedBy",
        approved_at::text AS "approvedAt", issued_at::text AS "issuedAt",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      FROM purchase_order
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as PurchaseOrderRecord) : null;
  }

  async findPoItems(poId: string): Promise<PurchaseOrderItemRecord[]> {
    const rows = await this.db`
      SELECT 
        id, po_id AS "poId", pr_item_id AS "prItemId", line_number AS "lineNumber",
        item_name AS "itemName",
        quantity_ordered::float AS "quantityOrdered",
        quantity_received::float AS "quantityReceived",
        quantity_invoiced::float AS "quantityInvoiced",
        uom, unit_price::float AS "unitPrice", subtotal::float AS "subtotal"
      FROM purchase_order_item
      WHERE po_id = ${poId}
      ORDER BY line_number ASC
    `;

    return rows as unknown as PurchaseOrderItemRecord[];
  }

  async updatePoStatus(id: string, status: PoStatus, approvedBy?: string, issuedAt?: boolean): Promise<PurchaseOrderRecord> {
    const rows = await this.db`
      UPDATE purchase_order
      SET
        status = ${status},
        approved_by = COALESCE(${approvedBy ?? null}::uuid, approved_by),
        approved_at = CASE WHEN ${approvedBy ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE approved_at END,
        issued_at = CASE WHEN ${issuedAt === true} THEN clock_timestamp() ELSE issued_at END,
        updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING
        id, po_number AS "poNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId", payment_term_type AS "paymentTermType",
        version_number AS "versionNumber", status,
        subtotal_amount::float AS "subtotalAmount", tax_amount::float AS "taxAmount",
        grand_total_amount::float AS "grandTotalAmount",
        terms_and_conditions AS "termsAndConditions",
        created_by AS "createdBy", approved_by AS "approvedBy",
        approved_at::text AS "approvedAt", issued_at::text AS "issuedAt",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as PurchaseOrderRecord;
  }

  async updatePoDirect(id: string, fields: Partial<PurchaseOrderRecord>): Promise<PurchaseOrderRecord> {
    const rows = await this.db`
      UPDATE purchase_order
      SET
        terms_and_conditions = COALESCE(${fields.termsAndConditions ?? null}, terms_and_conditions),
        subtotal_amount = COALESCE(${fields.subtotalAmount ?? null}, subtotal_amount),
        tax_amount = COALESCE(${fields.taxAmount ?? null}, tax_amount),
        grand_total_amount = COALESCE(${fields.grandTotalAmount ?? null}, grand_total_amount),
        version_number = COALESCE(${fields.versionNumber ?? null}, version_number),
        updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING
        id, po_number AS "poNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId", payment_term_type AS "paymentTermType",
        version_number AS "versionNumber", status,
        subtotal_amount::float AS "subtotalAmount", tax_amount::float AS "taxAmount",
        grand_total_amount::float AS "grandTotalAmount",
        terms_and_conditions AS "termsAndConditions",
        created_by AS "createdBy", approved_by AS "approvedBy",
        approved_at::text AS "approvedAt", issued_at::text AS "issuedAt",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as PurchaseOrderRecord;
  }

  async createAmendmentHistory(history: {
    id: string;
    poId: string;
    amendmentNumber: number;
    changeSummary: string;
    previousSnapshot: Record<string, unknown>;
    requestedBy: string;
    approvedBy: string;
  }): Promise<PoAmendmentHistoryRecord> {
    const rows = await this.db`
      INSERT INTO po_amendment_history (
        id, po_id, amendment_number, change_summary, previous_snapshot,
        requested_by, approved_by
      ) VALUES (
        ${history.id}, ${history.poId}, ${history.amendmentNumber},
        ${history.changeSummary}, ${JSON.stringify(history.previousSnapshot)}::jsonb,
        ${history.requestedBy}, ${history.approvedBy}
      )
      RETURNING
        id, po_id AS "poId", amendment_number AS "amendmentNumber",
        change_summary AS "changeSummary", previous_snapshot AS "previousSnapshot",
        requested_by AS "requestedBy", approved_by AS "approvedBy",
        approved_at::text AS "approvedAt"
    `;

    return rows[0] as unknown as PoAmendmentHistoryRecord;
  }

  async findAmendmentHistories(poId: string): Promise<PoAmendmentHistoryRecord[]> {
    const rows = await this.db`
      SELECT 
        id, po_id AS "poId", amendment_number AS "amendmentNumber",
        change_summary AS "changeSummary", previous_snapshot AS "previousSnapshot",
        requested_by AS "requestedBy", approved_by AS "approvedBy",
        approved_at::text AS "approvedAt"
      FROM po_amendment_history
      WHERE po_id = ${poId}
      ORDER BY amendment_number ASC
    `;

    return rows as unknown as PoAmendmentHistoryRecord[];
  }

  async getMaxAmendmentSequence(poId: string): Promise<number> {
    const rows = await this.db`
      SELECT COALESCE(MAX(amendment_number), 0) AS "maxSeq"
      FROM po_amendment_history
      WHERE po_id = ${poId}
    `;

    return Number(rows[0].maxSeq);
  }
}
