import { sql, type TransactionClient } from '../../db/client';
import type {
  PurchaseRequestRecord,
  PurchaseRequestItemRecord,
  ApprovalInstanceRecord,
  EmergencyPostReviewRecord,
  PrStatus,
} from './types';

export class PrRepository {
  constructor(private db: TransactionClient = sql) {}

  async create(pr: {
    id: string;
    prNumber: string;
    requesterId: string;
    costCenter: string;
    divisionId: string;
    branchId: string;
    requiredDate: string;
    paymentTermType: string;
    isEmergency: boolean;
    emergencyJustification?: string | null;
    businessJustification: string;
    status: PrStatus;
    totalEstimatedAmount: number;
  }): Promise<PurchaseRequestRecord> {
    const rows = await this.db`
      INSERT INTO purchase_request (
        id, pr_number, requester_id, cost_center, division_id, branch_id,
        required_date, payment_term_type, is_emergency, emergency_justification,
        business_justification, status, total_estimated_amount
      ) VALUES (
        ${pr.id}, ${pr.prNumber}, ${pr.requesterId}, ${pr.costCenter}, ${pr.divisionId}, ${pr.branchId},
        ${pr.requiredDate}, ${pr.paymentTermType}, ${pr.isEmergency}, ${pr.emergencyJustification ?? null},
        ${pr.businessJustification}, ${pr.status}, ${pr.totalEstimatedAmount}
      )
      RETURNING 
        id, pr_number AS "prNumber", requester_id AS "requesterId",
        cost_center AS "costCenter", division_id AS "divisionId", branch_id AS "branchId",
        required_date::text AS "requiredDate", payment_term_type AS "paymentTermType",
        is_emergency AS "isEmergency", emergency_justification AS "emergencyJustification",
        business_justification AS "businessJustification", status,
        total_estimated_amount::float AS "totalEstimatedAmount",
        locked_approval_policy_version AS "lockedApprovalPolicyVersion",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as PurchaseRequestRecord;
  }

  async insertItems(items: Array<{
    id: string;
    prId: string;
    lineNumber: number;
    itemName: string;
    specification?: string | null;
    quantityRequested: number;
    uom: string;
    estimatedUnitPrice: number;
  }>): Promise<PurchaseRequestItemRecord[]> {
    const results: PurchaseRequestItemRecord[] = [];

    for (const item of items) {
      const rows = await this.db`
        INSERT INTO purchase_request_item (
          id, pr_id, line_number, item_name, specification,
          quantity_requested, uom, estimated_unit_price
        ) VALUES (
          ${item.id}, ${item.prId}, ${item.lineNumber}, ${item.itemName}, ${item.specification ?? null},
          ${item.quantityRequested}, ${item.uom}, ${item.estimatedUnitPrice}
        )
        RETURNING
          id, pr_id AS "prId", line_number AS "lineNumber", item_name AS "itemName",
          specification, quantity_requested::float AS "quantityRequested",
          quantity_ordered::float AS "quantityOrdered", uom,
          estimated_unit_price::float AS "estimatedUnitPrice",
          subtotal::float AS "subtotal"
      `;
      results.push(rows[0] as unknown as PurchaseRequestItemRecord);
    }

    return results;
  }

  async findById(id: string): Promise<PurchaseRequestRecord | null> {
    const rows = await this.db`
      SELECT 
        pr.id, pr.pr_number AS "prNumber", pr.requester_id AS "requesterId",
        u.full_name AS "requesterName", u.email AS "requesterEmail",
        pr.cost_center AS "costCenter", pr.division_id AS "divisionId", pr.branch_id AS "branchId",
        pr.required_date::text AS "requiredDate", pr.payment_term_type AS "paymentTermType",
        pr.is_emergency AS "isEmergency", pr.emergency_justification AS "emergencyJustification",
        pr.business_justification AS "businessJustification", pr.status,
        pr.total_estimated_amount::float AS "totalEstimatedAmount",
        pr.locked_approval_policy_version AS "lockedApprovalPolicyVersion",
        pr.created_at::text AS "createdAt", pr.updated_at::text AS "updatedAt"
      FROM purchase_request pr
      LEFT JOIN app_user u ON u.id = pr.requester_id
      WHERE pr.id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as PurchaseRequestRecord) : null;
  }

  async findItemsByPrId(prId: string): Promise<PurchaseRequestItemRecord[]> {
    const rows = await this.db`
      SELECT 
        id, pr_id AS "prId", line_number AS "lineNumber", item_name AS "itemName",
        specification, quantity_requested::float AS "quantityRequested",
        quantity_ordered::float AS "quantityOrdered", uom,
        estimated_unit_price::float AS "estimatedUnitPrice",
        subtotal::float AS "subtotal"
      FROM purchase_request_item
      WHERE pr_id = ${prId}
      ORDER BY line_number ASC
    `;

    return rows as unknown as PurchaseRequestItemRecord[];
  }

  async findApprovalInstances(prId: string): Promise<ApprovalInstanceRecord[]> {
    const rows = await this.db`
      SELECT 
        id, pr_id AS "prId", step_order AS "stepOrder", assigned_role AS "assignedRole",
        assigned_user_id AS "assignedUserId", required_min_amount::float AS "requiredMinAmount",
        decision, decision_by AS "decisionBy", decision_at::text AS "decisionAt",
        rejection_reason AS "rejectionReason", delegated_from_user_id AS "delegatedFromUserId"
      FROM approval_instance
      WHERE pr_id = ${prId}
      ORDER BY step_order ASC
    `;

    return rows as unknown as ApprovalInstanceRecord[];
  }

  async updateStatusAndLock(
    id: string,
    status: PrStatus,
    lockedPolicyVersion?: string
  ): Promise<PurchaseRequestRecord> {
    const rows = await this.db`
      UPDATE purchase_request
      SET 
        status = ${status},
        locked_approval_policy_version = COALESCE(${lockedPolicyVersion ?? null}, locked_approval_policy_version),
        updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING 
        id, pr_number AS "prNumber", requester_id AS "requesterId",
        cost_center AS "costCenter", division_id AS "divisionId", branch_id AS "branchId",
        required_date::text AS "requiredDate", payment_term_type AS "paymentTermType",
        is_emergency AS "isEmergency", emergency_justification AS "emergencyJustification",
        business_justification AS "businessJustification", status,
        total_estimated_amount::float AS "totalEstimatedAmount",
        locked_approval_policy_version AS "lockedApprovalPolicyVersion",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as PurchaseRequestRecord;
  }

  async updateFields(id: string, fields: Partial<PurchaseRequestRecord>): Promise<PurchaseRequestRecord> {
    const rows = await this.db`
      UPDATE purchase_request
      SET
        cost_center = COALESCE(${fields.costCenter ?? null}, cost_center),
        division_id = COALESCE(${fields.divisionId ?? null}, division_id),
        branch_id = COALESCE(${fields.branchId ?? null}, branch_id),
        required_date = COALESCE(${fields.requiredDate ? new Date(fields.requiredDate) : null}, required_date),
        payment_term_type = COALESCE(${fields.paymentTermType ?? null}, payment_term_type),
        business_justification = COALESCE(${fields.businessJustification ?? null}, business_justification),
        is_emergency = COALESCE(${fields.isEmergency ?? null}, is_emergency),
        emergency_justification = COALESCE(${fields.emergencyJustification ?? null}, emergency_justification),
        total_estimated_amount = COALESCE(${fields.totalEstimatedAmount ?? null}, total_estimated_amount),
        updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING 
        id, pr_number AS "prNumber", requester_id AS "requesterId",
        cost_center AS "costCenter", division_id AS "divisionId", branch_id AS "branchId",
        required_date::text AS "requiredDate", payment_term_type AS "paymentTermType",
        is_emergency AS "isEmergency", emergency_justification AS "emergencyJustification",
        business_justification AS "businessJustification", status,
        total_estimated_amount::float AS "totalEstimatedAmount",
        locked_approval_policy_version AS "lockedApprovalPolicyVersion",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as PurchaseRequestRecord;
  }

  async createApprovalInstance(instance: {
    id: string;
    prId: string;
    stepOrder: number;
    assignedRole: string;
    assignedUserId?: string | null;
    requiredMinAmount: number;
    decision: string;
  }): Promise<ApprovalInstanceRecord> {
    const rows = await this.db`
      INSERT INTO approval_instance (
        id, pr_id, step_order, assigned_role, assigned_user_id, required_min_amount, decision
      ) VALUES (
        ${instance.id}, ${instance.prId}, ${instance.stepOrder}, ${instance.assignedRole},
        ${instance.assignedUserId ?? null}, ${instance.requiredMinAmount}, ${instance.decision}
      )
      RETURNING
        id, pr_id AS "prId", step_order AS "stepOrder", assigned_role AS "assignedRole",
        assigned_user_id AS "assignedUserId", required_min_amount::float AS "requiredMinAmount",
        decision, decision_by AS "decisionBy", decision_at::text AS "decisionAt",
        rejection_reason AS "rejectionReason", delegated_from_user_id AS "delegatedFromUserId"
    `;

    return rows[0] as unknown as ApprovalInstanceRecord;
  }

  async recordApprovalDecision(params: {
    instanceId: string;
    decision: 'APPROVED' | 'REJECTED';
    decisionBy: string;
    rejectionReason?: string | null;
    delegatedFromUserId?: string | null;
  }): Promise<ApprovalInstanceRecord> {
    const rows = await this.db`
      UPDATE approval_instance
      SET
        decision = ${params.decision},
        decision_by = ${params.decisionBy},
        decision_at = clock_timestamp(),
        rejection_reason = ${params.rejectionReason ?? null},
        delegated_from_user_id = ${params.delegatedFromUserId ?? null}
      WHERE id = ${params.instanceId}
      RETURNING
        id, pr_id AS "prId", step_order AS "stepOrder", assigned_role AS "assignedRole",
        assigned_user_id AS "assignedUserId", required_min_amount::float AS "requiredMinAmount",
        decision, decision_by AS "decisionBy", decision_at::text AS "decisionAt",
        rejection_reason AS "rejectionReason", delegated_from_user_id AS "delegatedFromUserId"
    `;

    return rows[0] as unknown as ApprovalInstanceRecord;
  }

  async createEmergencyPostReview(params: {
    id: string;
    prId: string;
    reviewDueDate: string;
  }): Promise<EmergencyPostReviewRecord> {
    const rows = await this.db`
      INSERT INTO emergency_post_review (
        id, pr_id, review_due_date, is_reviewed
      ) VALUES (
        ${params.id}, ${params.prId}, ${params.reviewDueDate}, FALSE
      )
      RETURNING
        id, pr_id AS "prId", po_id AS "poId", review_due_date::text AS "reviewDueDate",
        is_reviewed AS "isReviewed", reviewed_by AS "reviewedBy", reviewed_at::text AS "reviewedAt",
        audit_notes AS "auditNotes", created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as EmergencyPostReviewRecord;
  }

  async list(filters?: { requesterId?: string; status?: string; limit?: number; offset?: number }): Promise<PurchaseRequestRecord[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let query = sql`
      SELECT 
        pr.id, pr.pr_number AS "prNumber", pr.requester_id AS "requesterId",
        u.full_name AS "requesterName", u.email AS "requesterEmail",
        pr.cost_center AS "costCenter", pr.division_id AS "divisionId", pr.branch_id AS "branchId",
        pr.required_date::text AS "requiredDate", pr.payment_term_type AS "paymentTermType",
        pr.is_emergency AS "isEmergency", pr.emergency_justification AS "emergencyJustification",
        pr.business_justification AS "businessJustification", pr.status,
        pr.total_estimated_amount::float AS "totalEstimatedAmount",
        pr.locked_approval_policy_version AS "lockedApprovalPolicyVersion",
        pr.created_at::text AS "createdAt", pr.updated_at::text AS "updatedAt"
      FROM purchase_request pr
      LEFT JOIN app_user u ON u.id = pr.requester_id
      WHERE 1=1
    `;

    if (filters?.requesterId) {
      query = sql`${query} AND pr.requester_id = ${filters.requesterId}`;
    }
    if (filters?.status) {
      query = sql`${query} AND pr.status = ${filters.status}`;
    }

    query = sql`${query} ORDER BY pr.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const rows = await query;
    return rows as unknown as PurchaseRequestRecord[];
  }
}
