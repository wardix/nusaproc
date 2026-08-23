import { sql, withTransaction } from '../../db/client';
import { recordAuditTrailEntry } from '../audit/service';

export async function processExpiredDelegations(): Promise<number> {
  const expiredRows = await sql`
    UPDATE approval_delegation
    SET is_active = FALSE
    WHERE is_active = TRUE AND end_date < clock_timestamp()
    RETURNING id, delegator_id, delegatee_id, end_date
  `;

  for (const row of expiredRows) {
    try {
      await recordAuditTrailEntry({
        actionType: 'DELEGATION_EXPIRED_AUTO_REVOKED',
        entityName: 'approval_delegation',
        entityId: row.id,
        actorRole: 'ADMIN',
        ipAddress: '127.0.0.1',
        justification: `Delegasi approval kedaluwarsa pada ${row.end_date}. Hak persetujuan dikembalikan otomatis ke pendelegasi (R62).`,
        oldState: { id: row.id, isActive: true },
        newState: { id: row.id, isActive: false },
      });
    } catch {
      // Non-blocking audit record in background worker
    }
  }

  return expiredRows.length;
}

export async function deactivateUserAndRevokeDelegations(
  userId: string,
  deactivatedBy: string
): Promise<{ userDeactivated: boolean; delegationsRevoked: number }> {
  return await withTransaction(async (tx) => {
    // 1. Deactivate user account
    await tx`
      UPDATE app_user
      SET is_active = FALSE, updated_at = clock_timestamp()
      WHERE id = ${userId}
    `;

    // 2. Revoke all active delegations where user is delegator or delegatee (R64)
    const revokedDelegations = await tx`
      UPDATE approval_delegation
      SET is_active = FALSE
      WHERE is_active = TRUE AND (delegator_id = ${userId} OR delegatee_id = ${userId})
      RETURNING id, delegator_id, delegatee_id
    `;

    // 3. Log audit trail
    try {
      await recordAuditTrailEntry({
        actorId: deactivatedBy,
        actorRole: 'ADMIN',
        actionType: 'USER_DEACTIVATED_AND_DELEGATIONS_REVOKED',
        entityName: 'app_user',
        entityId: userId,
        ipAddress: '127.0.0.1',
        justification: `Pengguna dinonaktifkan. Seluruh ${revokedDelegations.length} delegasi aktif dibatalkan secara otomatis (R64).`,
        newState: {
          userId,
          isActive: false,
          revokedDelegationIds: revokedDelegations.map((d: { id: string }) => d.id),
        },
      });
    } catch {
      // Non-blocking
    }

    return {
      userDeactivated: true,
      delegationsRevoked: revokedDelegations.length,
    };
  });
}

export async function processPendingApprovalEscalations(
  maxHoursThreshold = 48,
  defaultEscalationUserId?: string
): Promise<number> {
  const thresholdInterval = `${maxHoursThreshold} hours`;

  // Find PR approval steps pending for > maxHoursThreshold
  const overdueApprovals = await sql`
    SELECT
      ai.id, ai.pr_id AS "prId", ai.assigned_user_id AS "assignedUserId",
      ai.step_order AS "stepOrder", pr.created_at AS "createdAt",
      pr.pr_number AS "prNumber"
    FROM approval_instance ai
    JOIN purchase_request pr ON pr.id = ai.pr_id
    WHERE ai.decision = 'PENDING'
      AND pr.created_at < (clock_timestamp() - ${thresholdInterval}::interval)
      AND pr.status = 'SUBMITTED'
  `;

  let escalatedCount = 0;

  for (const step of overdueApprovals) {
    const escalationTargetId = defaultEscalationUserId || step.assignedUserId;

    await withTransaction(async (tx) => {
      // Update the overdue pending step with escalated user and note
      await tx`
        UPDATE approval_instance
        SET
          assigned_user_id = ${escalationTargetId},
          rejection_reason = ${`ESCALATED (R63): Dialihkan otomatis setelah menunggu > ${maxHoursThreshold} jam tanpa respons.`}
        WHERE id = ${step.id}
      `;

      // Log audit trail
      try {
        await recordAuditTrailEntry({
          actionType: 'APPROVAL_AUTO_ESCALATED',
          entityName: 'purchase_request',
          entityId: step.prId,
          actorRole: 'ADMIN',
          ipAddress: '127.0.0.1',
          justification: `Dokumen PR ${step.prNumber} pending > ${maxHoursThreshold} jam. Dialihkan ke atasan/pengganti ${escalationTargetId} (R63).`,
          oldState: { previousAssignedUserId: step.assignedUserId },
          newState: { escalatedAssignedUserId: escalationTargetId, thresholdHours: maxHoursThreshold },
        });
      } catch {
        // Non-blocking
      }
    });

    escalatedCount++;
  }

  return escalatedCount;
}
