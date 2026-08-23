import { sql, type TransactionClient } from '../../db/client';
import type {
  PaymentProposalRecord,
  PaymentInvoiceAllocationRecord,
  PaymentProposalStatus,
} from './types';

export interface IdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  requestHash: string;
  responseCode?: number | null;
  responseBody?: Record<string, unknown> | null;
  createdAt: string;
  expiresAt: string;
}

export class PaymentRepository {
  constructor(private db: TransactionClient = sql) {}

  async createProposal(proposal: {
    id: string;
    proposalNumber: string;
    vendorId: string;
    vendorBankAccountId: string;
    totalPaymentAmount: number;
    paymentMethod: string;
    status: PaymentProposalStatus;
    proposedBy: string;
  }): Promise<PaymentProposalRecord> {
    const rows = await this.db`
      INSERT INTO payment_proposal (
        id, proposal_number, vendor_id, vendor_bank_account_id,
        total_payment_amount, payment_method, status, proposed_by
      ) VALUES (
        ${proposal.id}, ${proposal.proposalNumber}, ${proposal.vendorId}, ${proposal.vendorBankAccountId},
        ${proposal.totalPaymentAmount}, ${proposal.paymentMethod}, ${proposal.status}, ${proposal.proposedBy}
      )
      RETURNING
        id, proposal_number AS "proposalNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId",
        total_payment_amount::float AS "totalPaymentAmount",
        payment_method AS "paymentMethod", status,
        proposed_by AS "proposedBy", proposed_at::text AS "proposedAt",
        checked_by AS "checkedBy", checked_at::text AS "checkedAt",
        executed_by AS "executedBy", executed_at::text AS "executedAt",
        bank_reference_number AS "bankReferenceNumber",
        execution_receipt_file_id AS "executionReceiptFileId"
    `;

    return rows[0] as unknown as PaymentProposalRecord;
  }

  async insertAllocations(allocations: Array<{
    id: string;
    paymentProposalId: string;
    invoiceId: string;
    allocatedAmount: number;
    isAdvancePayment: boolean;
  }>): Promise<PaymentInvoiceAllocationRecord[]> {
    const results: PaymentInvoiceAllocationRecord[] = [];

    for (const alloc of allocations) {
      const rows = await this.db`
        INSERT INTO payment_invoice_allocation (
          id, payment_proposal_id, invoice_id, allocated_amount, is_advance_payment
        ) VALUES (
          ${alloc.id}, ${alloc.paymentProposalId}, ${alloc.invoiceId},
          ${alloc.allocatedAmount}, ${alloc.isAdvancePayment}
        )
        RETURNING
          id, payment_proposal_id AS "paymentProposalId", invoice_id AS "invoiceId",
          allocated_amount::float AS "allocatedAmount", is_advance_payment AS "isAdvancePayment"
      `;
      results.push(rows[0] as unknown as PaymentInvoiceAllocationRecord);
    }

    return results;
  }

  async findProposalById(id: string): Promise<PaymentProposalRecord | null> {
    const rows = await this.db`
      SELECT
        id, proposal_number AS "proposalNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId",
        total_payment_amount::float AS "totalPaymentAmount",
        payment_method AS "paymentMethod", status,
        proposed_by AS "proposedBy", proposed_at::text AS "proposedAt",
        checked_by AS "checkedBy", checked_at::text AS "checkedAt",
        executed_by AS "executedBy", executed_at::text AS "executedAt",
        bank_reference_number AS "bankReferenceNumber",
        execution_receipt_file_id AS "executionReceiptFileId"
      FROM payment_proposal
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as PaymentProposalRecord) : null;
  }

  async findAllocationsByProposalId(proposalId: string): Promise<PaymentInvoiceAllocationRecord[]> {
    const rows = await this.db`
      SELECT
        id, payment_proposal_id AS "paymentProposalId", invoice_id AS "invoiceId",
        allocated_amount::float AS "allocatedAmount", is_advance_payment AS "isAdvancePayment"
      FROM payment_invoice_allocation
      WHERE payment_proposal_id = ${proposalId}
    `;

    return rows as unknown as PaymentInvoiceAllocationRecord[];
  }

  async updateProposalStatus(
    id: string,
    status: PaymentProposalStatus,
    fields?: {
      checkedBy?: string | null;
      executedBy?: string | null;
      bankReferenceNumber?: string | null;
      executionReceiptFileId?: string | null;
    }
  ): Promise<PaymentProposalRecord> {
    const rows = await this.db`
      UPDATE payment_proposal
      SET
        status = ${status},
        checked_by = COALESCE(${fields?.checkedBy ?? null}::uuid, checked_by),
        checked_at = CASE WHEN ${fields?.checkedBy ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE checked_at END,
        executed_by = COALESCE(${fields?.executedBy ?? null}::uuid, executed_by),
        executed_at = CASE WHEN ${fields?.executedBy ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE executed_at END,
        bank_reference_number = COALESCE(${fields?.bankReferenceNumber ?? null}, bank_reference_number),
        execution_receipt_file_id = COALESCE(${fields?.executionReceiptFileId ?? null}::uuid, execution_receipt_file_id)
      WHERE id = ${id}
      RETURNING
        id, proposal_number AS "proposalNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId",
        total_payment_amount::float AS "totalPaymentAmount",
        payment_method AS "paymentMethod", status,
        proposed_by AS "proposedBy", proposed_at::text AS "proposedAt",
        checked_by AS "checkedBy", checked_at::text AS "checkedAt",
        executed_by AS "executedBy", executed_at::text AS "executedAt",
        bank_reference_number AS "bankReferenceNumber",
        execution_receipt_file_id AS "executionReceiptFileId"
    `;

    return rows[0] as unknown as PaymentProposalRecord;
  }

  async findProposals(filters?: { vendorId?: string; status?: string }): Promise<PaymentProposalRecord[]> {
    let query = sql`
      SELECT
        id, proposal_number AS "proposalNumber", vendor_id AS "vendorId",
        vendor_bank_account_id AS "vendorBankAccountId",
        total_payment_amount::float AS "totalPaymentAmount",
        payment_method AS "paymentMethod", status,
        proposed_by AS "proposedBy", proposed_at::text AS "proposedAt",
        checked_by AS "checkedBy", checked_at::text AS "checkedAt",
        executed_by AS "executedBy", executed_at::text AS "executedAt",
        bank_reference_number AS "bankReferenceNumber",
        execution_receipt_file_id AS "executionReceiptFileId"
      FROM payment_proposal
      WHERE 1=1
    `;

    if (filters?.vendorId) {
      query = sql`${query} AND vendor_id = ${filters.vendorId}`;
    }
    if (filters?.status) {
      query = sql`${query} AND status = ${filters.status}`;
    }

    query = sql`${query} ORDER BY proposed_at DESC LIMIT 50`;
    const rows = await query;
    return rows as unknown as PaymentProposalRecord[];
  }

  // Idempotency records
  async findIdempotencyKey(key: string): Promise<IdempotencyRecord | null> {
    const rows = await this.db`
      SELECT
        key, user_id AS "userId", endpoint, request_hash AS "requestHash",
        response_code AS "responseCode", response_body AS "responseBody",
        created_at::text AS "createdAt", expires_at::text AS "expiresAt"
      FROM idempotency_key_record
      WHERE key = ${key}
    `;

    return rows.length > 0 ? (rows[0] as unknown as IdempotencyRecord) : null;
  }

  async saveIdempotencyRecord(rec: {
    key: string;
    userId: string;
    endpoint: string;
    requestHash: string;
    responseCode: number;
    responseBody: Record<string, unknown>;
    expiresAt: Date;
  }): Promise<void> {
    await this.db`
      INSERT INTO idempotency_key_record (
        key, user_id, endpoint, request_hash,
        response_code, response_body, expires_at
      ) VALUES (
        ${rec.key}, ${rec.userId}, ${rec.endpoint}, ${rec.requestHash},
        ${rec.responseCode}, ${JSON.stringify(rec.responseBody)}::jsonb, ${rec.expiresAt.toISOString()}
      )
      ON CONFLICT (key) DO UPDATE
      SET
        response_code = ${rec.responseCode},
        response_body = ${JSON.stringify(rec.responseBody)}::jsonb
    `;
  }
}
