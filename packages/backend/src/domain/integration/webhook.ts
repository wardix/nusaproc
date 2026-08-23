import crypto from 'node:crypto';
import { sql, type TransactionClient } from '../../db/client';

export interface WebhookSubscriptionRecord {
  id: string;
  targetUrl: string;
  secretKey: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
}

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  processedAt: string | null;
  retryCount: number;
  lastError: string | null;
}

export function computeWebhookSignature(
  payload: string | Record<string, unknown>,
  secretKey: string
): string {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secretKey).update(serialized).digest('hex');
  return `sha256=${hmac}`;
}

export function verifyWebhookSignature(
  payload: string | Record<string, unknown>,
  signatureHeader: string,
  secretKey: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = computeWebhookSignature(payload, secretKey);
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function registerWebhookSubscription(data: {
  targetUrl: string;
  secretKey: string;
  subscribedEvents: string[];
}): Promise<string> {
  const id = crypto.randomUUID();
  const arrayLiteral = `{${data.subscribedEvents.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`;
  await sql`
    INSERT INTO webhook_subscription (
      id, target_url, secret_key, subscribed_events, is_active
    ) VALUES (
      ${id}, ${data.targetUrl}, ${data.secretKey}, ${arrayLiteral}::text[], TRUE
    )
  `;
  return id;
}

export async function enqueueOutboxEvent(
  eventType: string,
  payload: Record<string, unknown>,
  db: TransactionClient = sql
): Promise<string> {
  const id = crypto.randomUUID();
  await db`
    INSERT INTO outbox_event (
      id, event_type, payload
    ) VALUES (
      ${id}, ${eventType}, ${JSON.stringify(payload)}::jsonb
    )
  `;
  return id;
}

export async function processOutboxEvents(_options?: {
  ignoreBackoffDelay?: boolean;
}): Promise<{ processedCount: number; failedCount: number }> {
  const events = await sql`
    SELECT
      id, event_type AS "eventType", payload,
      retry_count AS "retryCount", last_error AS "lastError"
    FROM outbox_event
    WHERE processed_at IS NULL AND retry_count < 5
    ORDER BY created_at ASC
    LIMIT 50
  `;

  let processedCount = 0;
  let failedCount = 0;

  for (const event of events) {
    const eventId = event.id as string;
    const eventType = event.eventType as string;
    const rawPayload = event.payload;
    const payload: Record<string, unknown> =
      typeof rawPayload === 'string'
        ? JSON.parse(rawPayload)
        : (rawPayload as Record<string, unknown>);
    const currentRetries = Number(event.retryCount);

    const subs = await sql`
      SELECT id, target_url AS "targetUrl", secret_key AS "secretKey"
      FROM webhook_subscription
      WHERE is_active = TRUE AND (${eventType} = ANY(subscribed_events) OR '*' = ANY(subscribed_events))
    `;

    if (subs.length === 0) {
      await sql`
        UPDATE outbox_event
        SET processed_at = clock_timestamp()
        WHERE id = ${eventId}
      `;
      processedCount++;
      continue;
    }

    let allDelivered = true;
    let deliveryError = '';

    for (const sub of subs) {
      const signature = computeWebhookSignature(payload, sub.secretKey);

      try {
        const response = await fetch(sub.targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NusaProc-Signature': signature,
            'User-Agent': 'NusaProc-Webhook-Dispatcher/1.0',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) {
          allDelivered = false;
          deliveryError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (err: unknown) {
        allDelivered = false;
        deliveryError = (err as Error).message || 'Connection failed';
      }
    }

    if (allDelivered) {
      await sql`
        UPDATE outbox_event
        SET processed_at = clock_timestamp(), last_error = NULL
        WHERE id = ${eventId}
      `;
      processedCount++;
    } else {
      failedCount++;
      const nextRetryCount = currentRetries + 1;
      const isDeadLetter = nextRetryCount >= 5;

      const errorMessage = isDeadLetter
        ? `DEAD_LETTER_QUEUE (DLQ): Failed after 5 attempts. Last error: ${deliveryError}`
        : `Retry ${nextRetryCount}/5 failed: ${deliveryError}`;

      await sql`
        UPDATE outbox_event
        SET
          retry_count = ${nextRetryCount},
          last_error = ${errorMessage}
        WHERE id = ${eventId}
      `;
    }
  }

  return { processedCount, failedCount };
}
