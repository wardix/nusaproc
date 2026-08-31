import { sql } from '../../db/client';
import {
  createFeedbackSchema,
  updateFeedbackStatusSchema,
  type CreateFeedbackInput,
  type UpdateFeedbackStatusInput,
  type SystemFeedbackRecord,
  type FeedbackCategory,
  type FeedbackStatus,
} from './types';
import { NotFoundError } from '../sod/errors';

export async function submitFeedback(
  input: CreateFeedbackInput,
  userId?: string | null
): Promise<SystemFeedbackRecord> {
  const validated = createFeedbackSchema.parse(input);
  const id = crypto.randomUUID();

  // If userId is provided, verify it exists or leave as null
  let validUserId: string | null = null;
  if (userId) {
    const userCheck = await sql`SELECT id FROM app_user WHERE id = ${userId} LIMIT 1`;
    if (userCheck.length > 0) {
      validUserId = userCheck[0].id;
    }
  }

  const [row] = await sql`
    INSERT INTO system_feedback (
      id,
      user_id,
      category,
      urgency,
      title,
      description,
      page_url,
      active_role,
      screenshot_data,
      system_info,
      status
    ) VALUES (
      ${id},
      ${validUserId},
      ${validated.category},
      ${validated.urgency},
      ${validated.title || null},
      ${validated.description},
      ${validated.pageUrl},
      ${validated.activeRole},
      ${validated.screenshotData || null},
      ${validated.systemInfo ? JSON.stringify(validated.systemInfo) : null}::jsonb,
      'OPEN'
    )
    RETURNING
      id,
      user_id AS "userId",
      category,
      urgency,
      title,
      description,
      page_url AS "pageUrl",
      active_role AS "activeRole",
      screenshot_data AS "screenshotData",
      system_info AS "systemInfo",
      status,
      admin_notes AS "adminNotes",
      created_at AS "createdAt",
      updated_at AS "updatedAt";
  `;

  return row as SystemFeedbackRecord;
}

export async function listFeedbacks(params?: {
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SystemFeedbackRecord[]; total: number }> {
  const limit = Math.min(params?.limit || 50, 100);
  const offset = params?.offset || 0;
  const category = params?.category || null;
  const status = params?.status || null;
  const search = params?.search ? `%${params.search.trim()}%` : null;

  const countResult = await sql`
    SELECT COUNT(*)::int AS count
    FROM system_feedback f
    LEFT JOIN app_user u ON f.user_id = u.id
    WHERE (${category === null} OR f.category = ${category})
      AND (${status === null} OR f.status = ${status})
      AND (${search === null} OR f.description ILIKE ${search} OR f.title ILIKE ${search} OR u.full_name ILIKE ${search});
  `;
  const total = countResult[0]?.count || 0;

  const rows = await sql`
    SELECT
      f.id,
      f.user_id AS "userId",
      u.full_name AS "userFullName",
      u.email AS "userEmail",
      f.category,
      f.urgency,
      f.title,
      f.description,
      f.page_url AS "pageUrl",
      f.active_role AS "activeRole",
      f.screenshot_data AS "screenshotData",
      f.system_info AS "systemInfo",
      f.status,
      f.admin_notes AS "adminNotes",
      f.created_at AS "createdAt",
      f.updated_at AS "updatedAt"
    FROM system_feedback f
    LEFT JOIN app_user u ON f.user_id = u.id
    WHERE (${category === null} OR f.category = ${category})
      AND (${status === null} OR f.status = ${status})
      AND (${search === null} OR f.description ILIKE ${search} OR f.title ILIKE ${search} OR u.full_name ILIKE ${search})
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  return {
    items: rows as SystemFeedbackRecord[],
    total,
  };
}

export async function getFeedbackById(id: string): Promise<SystemFeedbackRecord> {
  const [row] = await sql`
    SELECT
      f.id,
      f.user_id AS "userId",
      u.full_name AS "userFullName",
      u.email AS "userEmail",
      f.category,
      f.urgency,
      f.title,
      f.description,
      f.page_url AS "pageUrl",
      f.active_role AS "activeRole",
      f.screenshot_data AS "screenshotData",
      f.system_info AS "systemInfo",
      f.status,
      f.admin_notes AS "adminNotes",
      f.created_at AS "createdAt",
      f.updated_at AS "updatedAt"
    FROM system_feedback f
    LEFT JOIN app_user u ON f.user_id = u.id
    WHERE f.id = ${id};
  `;

  if (!row) {
    throw new NotFoundError(`Feedback dengan ID '${id}' tidak ditemukan`);
  }

  return row as SystemFeedbackRecord;
}

export async function updateFeedbackStatus(
  id: string,
  input: UpdateFeedbackStatusInput
): Promise<SystemFeedbackRecord> {
  const validated = updateFeedbackStatusSchema.parse(input);

  await getFeedbackById(id);

  const [row] = await sql`
    UPDATE system_feedback
    SET
      status = ${validated.status},
      admin_notes = COALESCE(${validated.adminNotes !== undefined ? validated.adminNotes : null}, admin_notes),
      updated_at = clock_timestamp()
    WHERE id = ${id}
    RETURNING
      id,
      user_id AS "userId",
      category,
      urgency,
      title,
      description,
      page_url AS "pageUrl",
      active_role AS "activeRole",
      screenshot_data AS "screenshotData",
      system_info AS "systemInfo",
      status,
      admin_notes AS "adminNotes",
      created_at AS "createdAt",
      updated_at AS "updatedAt";
  `;

  return row as SystemFeedbackRecord;
}
