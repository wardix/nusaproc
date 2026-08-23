import { sql, type TransactionClient } from '../../db/client';

export interface InvoiceRecord {
  id: string;
  invoiceNumberInternal: string;
  vendorInvoiceNumber: string;
  vendorInvoiceNormalized: string;
  vendorId: string;
  poId: string;
  grId?: string | null;
  invoiceType: string;
  invoiceDate: string;
  dueDate: string;
  subtotalAmount: number;
  ppnAmount: number;
  pphAmount: number;
  totalPayableAmount: number;
  nsfpOriginal?: string | null;
  nsfpNormalized?: string | null;
  isNsfpValid: boolean;
  taxSnapshotId: string;
  matchStatus: string;
  isHeldForTax: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeInvoiceNumber(invNum: string): string {
  return invNum.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function normalizeNsfp(nsfp?: string | null): string | null {
  if (!nsfp) return null;
  return nsfp.replace(/[^0-9]/g, '');
}

export class InvoiceRepository {
  constructor(private db: TransactionClient = sql) {}

  async createInvoice(inv: {
    id: string;
    invoiceNumberInternal: string;
    vendorInvoiceNumber: string;
    vendorId: string;
    poId: string;
    grId?: string | null;
    invoiceType?: string;
    invoiceDate: string;
    dueDate: string;
    subtotalAmount: number;
    ppnAmount?: number;
    pphAmount?: number;
    totalPayableAmount: number;
    nsfpOriginal?: string | null;
    taxSnapshotId: string;
    uploadedBy: string;
  }): Promise<InvoiceRecord> {
    const normalizedInvoice = normalizeInvoiceNumber(inv.vendorInvoiceNumber);
    const normalizedNsfp = normalizeNsfp(inv.nsfpOriginal);
    const invoiceType = inv.invoiceType || 'STANDARD';
    const ppnAmount = inv.ppnAmount ?? 0;
    const pphAmount = inv.pphAmount ?? 0;

    const rows = await this.db`
      INSERT INTO invoice (
        id, invoice_number_internal, vendor_invoice_number, vendor_invoice_normalized,
        vendor_id, po_id, gr_id, invoice_type, invoice_date, due_date,
        subtotal_amount, ppn_amount, pph_amount, total_payable_amount,
        nsfp_original, nsfp_normalized, is_nsfp_valid,
        tax_snapshot_id, match_status, is_held_for_tax, uploaded_by
      ) VALUES (
        ${inv.id}, ${inv.invoiceNumberInternal}, ${inv.vendorInvoiceNumber}, ${normalizedInvoice},
        ${inv.vendorId}, ${inv.poId}, ${inv.grId ?? null}, ${invoiceType}, ${inv.invoiceDate}, ${inv.dueDate},
        ${inv.subtotalAmount}, ${ppnAmount}, ${pphAmount}, ${inv.totalPayableAmount},
        ${inv.nsfpOriginal ?? null}, ${normalizedNsfp}, ${Boolean(normalizedNsfp)},
        ${inv.taxSnapshotId}, 'UNMATCHED', FALSE, ${inv.uploadedBy}
      )
      RETURNING
        id, invoice_number_internal AS "invoiceNumberInternal",
        vendor_invoice_number AS "vendorInvoiceNumber",
        vendor_invoice_normalized AS "vendorInvoiceNormalized",
        vendor_id AS "vendorId", po_id AS "poId", gr_id AS "grId",
        invoice_type AS "invoiceType", invoice_date::text AS "invoiceDate",
        due_date::text AS "dueDate", subtotal_amount::float AS "subtotalAmount",
        ppn_amount::float AS "ppnAmount", pph_amount::float AS "pphAmount",
        total_payable_amount::float AS "totalPayableAmount",
        nsfp_original AS "nsfpOriginal", nsfp_normalized AS "nsfpNormalized",
        is_nsfp_valid AS "isNsfpValid", tax_snapshot_id AS "taxSnapshotId",
        match_status AS "matchStatus", is_held_for_tax AS "isHeldForTax",
        uploaded_by AS "uploadedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as InvoiceRecord;
  }

  async findInvoiceById(id: string): Promise<InvoiceRecord | null> {
    const rows = await this.db`
      SELECT
        id, invoice_number_internal AS "invoiceNumberInternal",
        vendor_invoice_number AS "vendorInvoiceNumber",
        vendor_invoice_normalized AS "vendorInvoiceNormalized",
        vendor_id AS "vendorId", po_id AS "poId", gr_id AS "grId",
        invoice_type AS "invoiceType", invoice_date::text AS "invoiceDate",
        due_date::text AS "dueDate", subtotal_amount::float AS "subtotalAmount",
        ppn_amount::float AS "ppnAmount", pph_amount::float AS "pphAmount",
        total_payable_amount::float AS "totalPayableAmount",
        nsfp_original AS "nsfpOriginal", nsfp_normalized AS "nsfpNormalized",
        is_nsfp_valid AS "isNsfpValid", tax_snapshot_id AS "taxSnapshotId",
        match_status AS "matchStatus", is_held_for_tax AS "isHeldForTax",
        uploaded_by AS "uploadedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      FROM invoice
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as InvoiceRecord) : null;
  }
}
