import { processOutboxEvents } from '../domain/integration/webhook';

export async function runWebhookWorker(): Promise<{ processedCount: number; failedCount: number }> {
  console.log('[WebhookWorker] Checking and dispatching pending outbox events...');
  const result = await processOutboxEvents();
  console.log(
    `[WebhookWorker] Completed run. Processed: ${result.processedCount}, Failed: ${result.failedCount}`
  );
  return result;
}

if (import.meta.main) {
  runWebhookWorker().catch((err) => {
    console.error('[WebhookWorker] Error in worker execution:', err);
    process.exit(1);
  });
}
