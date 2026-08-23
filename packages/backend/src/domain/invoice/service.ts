import { withTransaction } from '../../db/client';
import { InvoiceRepository } from './repository';
import { PoRepository } from '../po/repository';
import { ForbiddenError } from '../sod/errors';
import {
  createInvoiceSchema,
  overrideMatchingExceptionSchema,
  validateNsfp,
  type CreateInvoiceInput,
  type OverrideMatchingExceptionInput,
  type TwoWayMatchResult,
  type InvoiceRecord,
} from './types';

export type { CreateInvoiceInput, OverrideMatchingExceptionInput, TwoWayMatchResult, InvoiceRecord };
export { validateNsfp };

function generateInternalInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `INV-INT-${dateStr}-${randomSuffix}`;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceRecord> {
  const validated = createInvoiceSchema.parse(input);
  const repo = new InvoiceRepository();

  if (validated.nsfpOriginal) {
    const nsfpResult = validateNsfp(validated.nsfpOriginal);
    if (!nsfpResult.isValid) {
      throw new Error(
        `Format NSFP tidak valid (R35): '${validated.nsfpOriginal}' bukan format 16 digit standar atau 17 digit Coretax.`
      );
    }
  }

  const taxSnapshot = await repo.findTaxSnapshotById(validated.taxSnapshotId);
  if (!taxSnapshot) {
    throw new Error(`Tax snapshot dengan ID '${validated.taxSnapshotId}' tidak ditemukan.`);
  }

  return await repo.createInvoice({
    id: crypto.randomUUID(),
    invoiceNumberInternal: generateInternalInvoiceNumber(),
    vendorInvoiceNumber: validated.vendorInvoiceNumber,
    vendorId: validated.vendorId,
    poId: validated.poId,
    grId: validated.grId,
    invoiceType: validated.invoiceType,
    invoiceDate: validated.invoiceDate,
    dueDate: validated.dueDate,
    subtotalAmount: validated.subtotalAmount,
    ppnAmount: validated.ppnAmount,
    pphAmount: validated.pphAmount,
    totalPayableAmount: validated.totalPayableAmount,
    nsfpOriginal: validated.nsfpOriginal,
    taxSnapshotId: validated.taxSnapshotId,
    uploadedBy: validated.uploadedBy,
  });
}

export async function runTwoWayMatching(invoiceId: string): Promise<TwoWayMatchResult> {
  return await withTransaction(async (tx) => {
    const invoiceRepo = new InvoiceRepository(tx);
    const poRepo = new PoRepository(tx);

    const invoice = await invoiceRepo.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice '${invoiceId}' tidak ditemukan.`);
    }

    const po = await poRepo.findPoById(invoice.poId);
    if (!po) {
      throw new Error(`Purchase Order '${invoice.poId}' tidak ditemukan.`);
    }

    // Calculate Variance
    const poExpectedAmount = Number(po.grandTotalAmount);
    const invoiceAmount = Number(invoice.totalPayableAmount);
    const varianceAmount = Math.abs(invoiceAmount - poExpectedAmount);
    const variancePercentage = poExpectedAmount > 0 ? (varianceAmount / poExpectedAmount) * 100 : 0;

    // Tolerance thresholds (R38: <= Rp 100.000 OR <= 1.0%)
    const isWithinTolerance = varianceAmount <= 100_000 || variancePercentage <= 1.0;

    if (isWithinTolerance) {
      await invoiceRepo.updateInvoiceMatchStatus(invoiceId, 'MATCHED_OK', false);
      return {
        invoiceId,
        matchStatus: 'MATCHED_OK',
        isHeldForTax: false,
        varianceAmount,
        variancePercentage,
        exceptions: [],
      };
    } else {
      await invoiceRepo.updateInvoiceMatchStatus(invoiceId, 'MATCHED_WITH_EXCEPTION', true);

      const exception = await invoiceRepo.createMatchingException({
        id: crypto.randomUUID(),
        invoiceId,
        exceptionCode: 'PRICE_VARIANCE_EXCEEDED',
        description: `Selisih nilai invoice (Rp ${invoiceAmount.toLocaleString('id-ID')}) vs PO (Rp ${poExpectedAmount.toLocaleString('id-ID')}) melebihi batas toleransi wajar (selisih: Rp ${varianceAmount.toLocaleString('id-ID')}, ${variancePercentage.toFixed(2)}%).`,
        varianceAmount,
        variancePercentage,
      });

      return {
        invoiceId,
        matchStatus: 'MATCHED_WITH_EXCEPTION',
        isHeldForTax: true,
        varianceAmount,
        variancePercentage,
        exceptions: [exception],
      };
    }
  });
}

export async function overrideMatchingException(
  input: OverrideMatchingExceptionInput
): Promise<InvoiceRecord> {
  const validated = overrideMatchingExceptionSchema.parse(input);

  return await withTransaction(async (tx) => {
    const invoiceRepo = new InvoiceRepository(tx);

    const invoice = await invoiceRepo.findInvoiceById(validated.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice '${validated.invoiceId}' tidak ditemukan.`);
    }

    // Verify user authorization for Head of AP / Finance / Admin
    const roles = await invoiceRepo.findUserRoles(validated.userId);
    const isAuthorized = roles.some((role) =>
      ['FINANCE', 'ADMIN', 'HEAD_OF_AP', 'APPROVER'].includes(role)
    );

    if (!isAuthorized) {
      throw new ForbiddenError(
        'Hanya Head of AP / Finance / Admin yang berwenang melakukan override pengecualian matching (R39).'
      );
    }

    await invoiceRepo.overrideMatchingExceptions(
      validated.invoiceId,
      validated.userId,
      validated.overrideReason
    );

    return await invoiceRepo.updateInvoiceMatchStatus(
      validated.invoiceId,
      'EXCEPTION_OVERRIDDEN',
      false
    );
  });
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceRecord> {
  const repo = new InvoiceRepository();
  const invoice = await repo.findInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice '${invoiceId}' tidak ditemukan.`);
  }
  return invoice;
}

export async function listInvoices(filters?: {
  vendorId?: string;
  poId?: string;
  matchStatus?: string;
}): Promise<InvoiceRecord[]> {
  const repo = new InvoiceRepository();
  return await repo.findInvoices(filters);
}
