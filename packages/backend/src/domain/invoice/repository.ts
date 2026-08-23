import { sql, type TransactionClient } from '../../db/client';
import type {
  InvoiceRecord,
  InvoiceMatchingExceptionRecord,
  TaxRuleSnapshotRecord,
  MatchStatus,
  InvoiceType,
} from './types';
import { validateNsfp } from './types';

export function normalizeInvoiceNumber(invNum: string): string {
  return invNum.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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
    invoiceType?: InvoiceType;
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
    const nsfpVal = validateNsfp(inv.nsfpOriginal);
    const invoiceType = inv.invoiceType || 'STANDARD';
    const ppnAmount = inv.ppnAmount ?? 0;
    const pphAmount = inv.pphAmount ?? 0;

    try {
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
          ${inv.nsfpOriginal ?? null}, ${nsfpVal.normalized}, ${nsfpVal.isValid},
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
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ERR_POSTGRES_SERVER_ERROR') {
        const pgErr = err as { errno?: string; message?: string };
        if (pgErr.errno === '23505') {
          throw new Error(
            `Invoice duplikat terdeteksi (R34): Invoice dengan vendor, nomor ('${inv.vendorInvoiceNumber}'), tanggal, dan nominal yang sama sudah terdaftar.`
          );
        }
      }
      throw err;
    }
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

  async findInvoices(filters?: { vendorId?: string; poId?: string; matchStatus?: string }): Promise<InvoiceRecord[]> {
    let query = sql`
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
      WHERE 1=1
    `;

    if (filters?.vendorId) {
      query = sql`${query} AND vendor_id = ${filters.vendorId}`;
    }
    if (filters?.poId) {
      query = sql`${query} AND po_id = ${filters.poId}`;
    }
    if (filters?.matchStatus) {
      query = sql`${query} AND match_status = ${filters.matchStatus}`;
    }

    query = sql`${query} ORDER BY created_at DESC LIMIT 50`;
    const rows = await query;
    return rows as unknown as InvoiceRecord[];
  }

  async updateInvoiceMatchStatus(
    id: string,
    matchStatus: MatchStatus,
    isHeldForTax: boolean
  ): Promise<InvoiceRecord> {
    const rows = await this.db`
      UPDATE invoice
      SET
        match_status = ${matchStatus},
        is_held_for_tax = ${isHeldForTax},
        updated_at = clock_timestamp()
      WHERE id = ${id}
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

  async createMatchingException(exc: {
    id: string;
    invoiceId: string;
    exceptionCode: string;
    description: string;
    varianceAmount: number;
    variancePercentage: number;
  }): Promise<InvoiceMatchingExceptionRecord> {
    const rows = await this.db`
      INSERT INTO invoice_matching_exception (
        id, invoice_id, exception_code, description,
        variance_amount, variance_percentage, is_overridden
      ) VALUES (
        ${exc.id}, ${exc.invoiceId}, ${exc.exceptionCode}, ${exc.description},
        ${exc.varianceAmount}, ${exc.variancePercentage}, FALSE
      )
      RETURNING
        id, invoice_id AS "invoiceId", exception_code AS "exceptionCode",
        description, variance_amount::float AS "varianceAmount",
        variance_percentage::float AS "variancePercentage",
        is_overridden AS "isOverridden", override_reason AS "overrideReason",
        overridden_by AS "overriddenBy", overridden_at::text AS "overriddenAt",
        created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as InvoiceMatchingExceptionRecord;
  }

  async findMatchingExceptionsByInvoiceId(invoiceId: string): Promise<InvoiceMatchingExceptionRecord[]> {
    const rows = await this.db`
      SELECT
        id, invoice_id AS "invoiceId", exception_code AS "exceptionCode",
        description, variance_amount::float AS "varianceAmount",
        variance_percentage::float AS "variancePercentage",
        is_overridden AS "isOverridden", override_reason AS "overrideReason",
        overridden_by AS "overriddenBy", overridden_at::text AS "overriddenAt",
        created_at::text AS "createdAt"
      FROM invoice_matching_exception
      WHERE invoice_id = ${invoiceId}
      ORDER BY created_at ASC
    `;

    return rows as unknown as InvoiceMatchingExceptionRecord[];
  }

  async overrideMatchingExceptions(
    invoiceId: string,
    userId: string,
    overrideReason: string
  ): Promise<void> {
    await this.db`
      UPDATE invoice_matching_exception
      SET
        is_overridden = TRUE,
        override_reason = ${overrideReason},
        overridden_by = ${userId},
        overridden_at = clock_timestamp()
      WHERE invoice_id = ${invoiceId}
    `;
  }

  async findTaxSnapshotById(id: string): Promise<TaxRuleSnapshotRecord | null> {
    const rows = await this.db`
      SELECT
        id, captured_at::text AS "capturedAt",
        ppn_rate::float AS "ppnRate", dpp_factor::float AS "dppFactor",
        pph_article AS "pphArticle", pph_rate::float AS "pphRate",
        tax_regulation_ref AS "taxRegulationRef"
      FROM tax_rule_snapshot
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as TaxRuleSnapshotRecord) : null;
  }

  async findUserRoles(userId: string): Promise<string[]> {
    const rows = (await this.db`
      SELECT role FROM user_role_assignment WHERE user_id = ${userId}
    `) as unknown as Array<{ role: string }>;
    return rows.map((r) => r.role);
  }
}
