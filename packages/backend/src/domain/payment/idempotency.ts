import { PaymentRepository } from './repository';

// In-memory mutex map to ensure atomic execution during concurrent in-flight requests
const inFlightLocks = new Map<string, Promise<unknown>>();

export async function executeWithIdempotency<T>(
  key: string | undefined,
  userId: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!key) {
    return await fn();
  }

  const repo = new PaymentRepository();

  // 1. Check if key is already resolved in DB
  const existing = await repo.findIdempotencyKey(key);
  if (existing && existing.responseCode && existing.responseBody) {
    const data =
      typeof existing.responseBody === 'string'
        ? JSON.parse(existing.responseBody)
        : existing.responseBody;
    return data as T;
  }

  // 2. Concurrency Lock: If another execution with the same key is in-flight, await its completion
  if (inFlightLocks.has(key)) {
    await inFlightLocks.get(key);
    const resolved = await repo.findIdempotencyKey(key);
    if (resolved && resolved.responseBody) {
      const data =
        typeof resolved.responseBody === 'string'
          ? JSON.parse(resolved.responseBody)
          : resolved.responseBody;
      return data as T;
    }
  }

  const executionPromise = (async () => {
    const result = await fn();

    // 3. Save resolved response
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await repo.saveIdempotencyRecord({
      key,
      userId,
      endpoint,
      requestHash: Buffer.from(key).toString('hex').slice(0, 32),
      responseCode: 200,
      responseBody: result as unknown as Record<string, unknown>,
      expiresAt,
    });

    return result;
  })();

  inFlightLocks.set(key, executionPromise);

  try {
    return await executionPromise;
  } finally {
    inFlightLocks.delete(key);
  }
}
