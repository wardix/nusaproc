import { withTransaction } from '../../db/client';
import { PaymentRepository } from './repository';
import { VendorRepository } from '../vendor/repository';
import { InvoiceRepository } from '../invoice/repository';
import { validateSodAction } from '../sod/validator';
import { verifyReauthToken } from '../auth/token';
import { StepUpRequiredError } from '../sod/errors';
import { executeWithIdempotency } from './idempotency';
import {
  proposePaymentSchema,
  checkPaymentProposalSchema,
  executePaymentSchema,
  type ProposePaymentInput,
  type CheckPaymentProposalInput,
  type ExecutePaymentInput,
  type PaymentProposalRecord,
  type PaymentProposalWithDetails,
} from './types';

export type {
  ProposePaymentInput,
  CheckPaymentProposalInput,
  ExecutePaymentInput,
  PaymentProposalRecord,
  PaymentProposalWithDetails,
};

function generateProposalNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `PAY-${dateStr}-${randomSuffix}`;
}

export async function proposePayment(input: ProposePaymentInput): Promise<PaymentProposalRecord> {
  const validated = proposePaymentSchema.parse(input);

  const vendorRepo = new VendorRepository();
  const invoiceRepo = new InvoiceRepository();

  const vendor = await vendorRepo.findVendorById(validated.vendorId);
  if (!vendor) {
    throw new Error(`Vendor '${validated.vendorId}' tidak ditemukan.`);
  }

  const bankAccount = await vendorRepo.findBankAccountById(validated.vendorBankAccountId);
  if (!bankAccount || bankAccount.status !== 'VERIFIED') {
    throw new Error('Rekening bank vendor wajib berstatus VERIFIED untuk pengajuan pembayaran.');
  }

  // Validate allocations
  let totalPaymentAmount = 0;
  for (const alloc of validated.allocations) {
    totalPaymentAmount += alloc.allocatedAmount;

    const invoice = await invoiceRepo.findInvoiceById(alloc.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice '${alloc.invoiceId}' tidak ditemukan.`);
    }

    if (!alloc.isAdvancePayment) {
      if (invoice.isHeldForTax || invoice.matchStatus === 'MATCHED_WITH_EXCEPTION') {
        throw new Error(
          `Invoice '${invoice.vendorInvoiceNumber}' berstatus ${invoice.matchStatus} dan sedang ditahan untuk pembayaran (R38). Lakukan override terlebih dahulu jika disetujui.`
        );
      }
    }
  }

  const proposalId = crypto.randomUUID();
  const proposalNumber = generateProposalNumber();

  return await withTransaction(async (tx) => {
    const repo = new PaymentRepository(tx);

    const proposal = await repo.createProposal({
      id: proposalId,
      proposalNumber,
      vendorId: validated.vendorId,
      vendorBankAccountId: validated.vendorBankAccountId,
      totalPaymentAmount,
      paymentMethod: validated.paymentMethod || 'BANK_TRANSFER',
      status: 'PROPOSED',
      proposedBy: validated.proposedBy,
    });

    const allocationsToInsert = validated.allocations.map((alloc) => ({
      id: crypto.randomUUID(),
      paymentProposalId: proposalId,
      invoiceId: alloc.invoiceId,
      allocatedAmount: alloc.allocatedAmount,
      isAdvancePayment: alloc.isAdvancePayment ?? false,
    }));

    await repo.insertAllocations(allocationsToInsert);

    return proposal;
  });
}

export async function checkPaymentProposal(
  input: CheckPaymentProposalInput
): Promise<PaymentProposalRecord> {
  const validated = checkPaymentProposalSchema.parse(input);
  const repo = new PaymentRepository();

  const proposal = await repo.findProposalById(validated.proposalId);
  if (!proposal) {
    throw new Error(`Proposal pembayaran '${validated.proposalId}' tidak ditemukan.`);
  }

  if (proposal.status !== 'PROPOSED') {
    throw new Error(`Hanya proposal berstatus PROPOSED yang dapat diperiksa. Status saat ini: ${proposal.status}`);
  }

  // R42: Maker-Checker SoD Enforcement
  validateSodAction(validated.checkedBy, 'CHECK_PAYMENT', {
    paymentProposerId: proposal.proposedBy,
  });

  return await repo.updateProposalStatus(validated.proposalId, 'CHECKED', {
    checkedBy: validated.checkedBy,
  });
}

export async function executePaymentTransfer(
  input: ExecutePaymentInput
): Promise<PaymentProposalRecord> {
  const validated = executePaymentSchema.parse(input);

  return await executeWithIdempotency(
    validated.idempotencyKey,
    validated.executedBy,
    `/payments/proposals/${validated.proposalId}/execute`,
    async () => {
      // Step-Up Re-Authentication (R5, R43)
      try {
        const verified = await verifyReauthToken(validated.reauthToken, 'EXECUTE_PAYMENT');
        if (verified.userId !== validated.executedBy) {
          throw new StepUpRequiredError('Reauth token tidak terikat pada pengguna yang mengeksekusi');
        }
      } catch (err: unknown) {
        if (err instanceof StepUpRequiredError) throw err;
        throw new StepUpRequiredError(
          err instanceof Error ? err.message : 'Step-Up Re-Authentication gagal atau token tidak valid'
        );
      }

      return await withTransaction(async (tx) => {
        const repo = new PaymentRepository(tx);

        const proposal = await repo.findProposalById(validated.proposalId);
        if (!proposal) {
          throw new Error(`Proposal pembayaran '${validated.proposalId}' tidak ditemukan.`);
        }

        if (proposal.status === 'EXECUTED') {
          return proposal;
        }

        if (proposal.status !== 'CHECKED') {
          throw new Error(
            `Hanya proposal berstatus CHECKED yang dapat dieksekusi transfer. Status saat ini: ${proposal.status}`
          );
        }

        // R42: Executor SoD Enforcement (Must be distinct from Maker & Checker)
        validateSodAction(validated.executedBy, 'EXECUTE_PAYMENT', {
          paymentProposerId: proposal.proposedBy,
          paymentCheckerId: proposal.checkedBy || undefined,
        });

        return await repo.updateProposalStatus(validated.proposalId, 'EXECUTED', {
          executedBy: validated.executedBy,
          bankReferenceNumber: validated.bankReferenceNumber || 'TRF-SUCCESS',
          executionReceiptFileId: validated.executionReceiptFileId,
        });
      });
    }
  );
}

export async function getPaymentProposalById(id: string): Promise<PaymentProposalWithDetails> {
  const repo = new PaymentRepository();
  const proposal = await repo.findProposalById(id);
  if (!proposal) {
    throw new Error(`Proposal pembayaran '${id}' tidak ditemukan.`);
  }

  const allocations = await repo.findAllocationsByProposalId(id);

  return {
    ...proposal,
    allocations,
  };
}

export async function listPaymentProposals(filters?: {
  vendorId?: string;
  status?: string;
}): Promise<PaymentProposalRecord[]> {
  const repo = new PaymentRepository();
  return await repo.findProposals(filters);
}
