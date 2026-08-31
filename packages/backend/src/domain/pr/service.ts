import { sql, withTransaction } from '../../db/client';
import { PrRepository } from './repository';
import {
  createPrSchema,
  type CreatePrInput,
  type UpdatePrInput,
  type DecideApprovalInput,
  type PrWithDetails,
  type PurchaseRequestRecord,
} from './types';

export type { CreatePrInput, UpdatePrInput, DecideApprovalInput, PrWithDetails, PurchaseRequestRecord };
import { validateSodAction } from '../sod/validator';
import { validateApprovalScope } from '../sod/scope';

function generatePrNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `PR-${dateStr}-${randomSuffix}`;
}

export async function createPurchaseRequest(input: CreatePrInput): Promise<PrWithDetails> {
  // 1. Zod Validation (R6, R7, R8, R48)
  const validated = createPrSchema.parse(input);

  const prId = crypto.randomUUID();
  const prNumber = generatePrNumber();

  // 2. Calculate Total Estimated Amount
  let totalEstimatedAmount = 0;
  const itemsToInsert = validated.items.map((item, index) => {
    const qty = Number(item.quantityRequested);
    const unitPrice = Number(item.estimatedUnitPrice);
    totalEstimatedAmount += qty * unitPrice;

    return {
      id: crypto.randomUUID(),
      prId,
      lineNumber: item.lineNumber || index + 1,
      itemName: item.itemName,
      specification: item.specification || null,
      quantityRequested: qty,
      uom: item.uom,
      estimatedUnitPrice: unitPrice,
    };
  });

  return await withTransaction(async (tx) => {
    const repo = new PrRepository(tx);

    const pr = await repo.create({
      id: prId,
      prNumber,
      requesterId: input.requesterId,
      costCenter: validated.costCenter,
      divisionId: validated.divisionId,
      branchId: validated.branchId,
      requiredDate: validated.requiredDate,
      paymentTermType: validated.paymentTermType,
      isEmergency: validated.isEmergency,
      emergencyJustification: validated.emergencyJustification || null,
      businessJustification: validated.businessJustification,
      status: 'DRAFT',
      totalEstimatedAmount,
    });

    const items = await repo.insertItems(itemsToInsert);

    // Auto-register any new UOM into master_uom (Pendekatan 2)
    for (const item of itemsToInsert) {
      if (item.uom && item.uom.trim()) {
        const trimmed = item.uom.trim();
        const code = trimmed.toUpperCase().replace(/\s+/g, '_');
        await tx`
          INSERT INTO master_uom (code, name, is_active)
          VALUES (${code}, ${trimmed}, TRUE)
          ON CONFLICT (code) DO UPDATE SET is_active = TRUE;
        `;
      }
    }

    return {
      ...pr,
      items,
      approvalInstances: [],
    };
  });
}

export async function submitPurchaseRequest(prId: string, requesterId: string): Promise<PurchaseRequestRecord> {
  return await withTransaction(async (tx) => {
    const repo = new PrRepository(tx);
    const pr = await repo.findById(prId);

    if (!pr) {
      throw new Error(`Purchase Request dengan ID '${prId}' tidak ditemukan.`);
    }

    if (pr.status !== 'DRAFT') {
      throw new Error(`Hanya PR berstatus DRAFT yang dapat diajukan (status saat ini: ${pr.status}).`);
    }

    if (pr.requesterId !== requesterId) {
      throw new Error('Hanya pembuat (requester) yang berhak mengajukan PR ini.');
    }

    // 1. Lock Approval Policy Version (R12)
    const lockedPolicyVersion = 'v1.0';
    const updatedPr = await repo.updateStatusAndLock(prId, 'SUBMITTED', lockedPolicyVersion);

    // 2. Generate Approval Steps based on Amount Thresholds (R12, R13)
    const totalAmount = Number(pr.totalEstimatedAmount);

    // Step 1: Initial Division Approver / Team Lead
    await repo.createApprovalInstance({
      id: crypto.randomUUID(),
      prId,
      stepOrder: 1,
      assignedRole: 'APPROVER',
      requiredMinAmount: 0.00,
      decision: 'PENDING',
    });

    // Step 2: Senior Manager / Director if > 50jt
    if (totalAmount > 50_000_000) {
      await repo.createApprovalInstance({
        id: crypto.randomUUID(),
        prId,
        stepOrder: 2,
        assignedRole: 'APPROVER',
        requiredMinAmount: 50_000_000.00,
        decision: 'PENDING',
      });
    }

    return updatedPr;
  });
}

export async function decideApprovalStep(input: DecideApprovalInput): Promise<PurchaseRequestRecord> {
  const { prId, approverId, decision, rejectionReason, approverMaxLimit, approverDivisionId } = input;

  return await withTransaction(async (tx) => {
    const repo = new PrRepository(tx);
    const pr = await repo.findById(prId);

    if (!pr) {
      throw new Error(`Purchase Request '${prId}' tidak ditemukan.`);
    }

    if (pr.status !== 'SUBMITTED') {
      throw new Error(`PR '${prId}' tidak berada dalam antrean persetujuan (status: ${pr.status}).`);
    }

    // 1. SoD Validation (R15: Self-Approval Prevention)
    validateSodAction(approverId, 'APPROVE_PR', { prRequesterId: pr.requesterId });

    // 2. Scope & Hierarchy Validation (R13)
    if (approverMaxLimit !== undefined) {
      validateApprovalScope({
        userId: approverId,
        userMaxLimit: approverMaxLimit,
        userDivisionId: approverDivisionId || pr.divisionId,
        requestAmount: Number(pr.totalEstimatedAmount),
        requestDivisionId: pr.divisionId,
      });
    }

    // 3. Find Current Pending Step
    const instances = await repo.findApprovalInstances(prId);
    const currentStep = instances.find((i) => i.decision === 'PENDING');

    if (!currentStep) {
      throw new Error('Tidak ada jenjang persetujuan yang menunggu tindakan.');
    }

    if (decision === 'REJECTED' && (!rejectionReason || rejectionReason.trim() === '')) {
      throw new Error('Penolakan PR wajib disertai alasan (R14).');
    }

    // 4. Record Approval Decision
    await repo.recordApprovalDecision({
      instanceId: currentStep.id,
      decision,
      decisionBy: approverId,
      rejectionReason: rejectionReason || null,
    });

    if (decision === 'REJECTED') {
      // Final State: REJECTED (R9: No revision path)
      return await repo.updateStatusAndLock(prId, 'REJECTED');
    }

    // Check if more steps remain
    const remainingPending = instances.filter(
      (i) => i.id !== currentStep.id && i.decision === 'PENDING'
    );

    if (remainingPending.length === 0) {
      // All approvers have approved -> Transition to APPROVED
      const approvedPr = await repo.updateStatusAndLock(prId, 'APPROVED');

      // 5. Emergency Post-Review Auto Entry (R49)
      if (pr.isEmergency) {
        const reviewDueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        await repo.createEmergencyPostReview({
          id: crypto.randomUUID(),
          prId,
          reviewDueDate,
        });
      }

      return approvedPr;
    }

    return pr;
  });
}

export async function updatePurchaseRequest(
  prId: string,
  input: UpdatePrInput
): Promise<PurchaseRequestRecord> {
  const repo = new PrRepository();
  const pr = await repo.findById(prId);

  if (!pr) {
    throw new Error(`Purchase Request '${prId}' tidak ditemukan.`);
  }

  // R9: Rejected PR is strictly immutable
  if (pr.status === 'REJECTED') {
    throw new Error('PR yang telah ditolak tidak dapat diubah (R9). Silakan buat PR baru.');
  }

  if (pr.status !== 'DRAFT') {
    throw new Error(`Hanya PR berstatus DRAFT yang dapat diedit (status saat ini: ${pr.status}).`);
  }

  return await repo.updateFields(prId, input as Partial<PurchaseRequestRecord>);
}

export async function closePartialPurchaseRequest(
  prId: string,
  _userId: string,
  _reason: string
): Promise<PurchaseRequestRecord> {
  const repo = new PrRepository();
  const pr = await repo.findById(prId);

  if (!pr) {
    throw new Error(`Purchase Request '${prId}' tidak ditemukan.`);
  }

  if (pr.status !== 'APPROVED') {
    throw new Error(`Hanya PR berstatus APPROVED yang dapat ditutup sebagian (R11). Status saat ini: ${pr.status}`);
  }

  return await repo.updateStatusAndLock(prId, 'CLOSED_PARTIAL');
}

export async function getPurchaseRequestById(prId: string): Promise<PrWithDetails> {
  const repo = new PrRepository();
  const pr = await repo.findById(prId);

  if (!pr) {
    throw new Error(`Purchase Request '${prId}' tidak ditemukan.`);
  }

  const items = await repo.findItemsByPrId(prId);
  const approvalInstances = await repo.findApprovalInstances(prId);

  return {
    ...pr,
    items,
    approvalInstances,
  };
}

export async function listMasterUoms(params?: {
  search?: string;
  isActive?: boolean;
}): Promise<Array<{ id: string; code: string; name: string; isActive: boolean }>> {
  const isActive = params?.isActive !== undefined ? params.isActive : true;
  const searchPattern = params?.search ? `%${params.search.trim()}%` : null;

  return await sql`
    SELECT id, code, name, is_active AS "isActive"
    FROM master_uom
    WHERE (${isActive === undefined} OR is_active = ${isActive})
      AND (${searchPattern === null} OR name ILIKE ${searchPattern} OR code ILIKE ${searchPattern})
    ORDER BY name ASC;
  `;
}
