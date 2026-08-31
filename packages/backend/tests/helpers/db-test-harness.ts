import { sql, type TransactionClient } from '../../src/db/client';

/**
 * Sentinel error used to trigger a transaction rollback in test suites
 * without leaking errors to the caller when the test function completes successfully.
 */
export class TestRollbackSentinel<T = unknown> extends Error {
  constructor(public readonly result: T) {
    super('TEST_TRANSACTION_ROLLBACK_SENTINEL');
    this.name = 'TestRollbackSentinel';
  }
}

/**
 * Executes a test callback within an isolated database transaction that is ALWAYS
 * rolled back upon completion. This ensures zero leftover test data in the database.
 *
 * If the test callback succeeds, the transaction is rolled back and the return value is returned.
 * If the test callback throws an error, the transaction is rolled back and the error is re-thrown.
 */
export async function runTestInRollback<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  let executionResult: T;

  try {
    await sql.begin(async (tx) => {
      executionResult = await callback(tx as TransactionClient);
      throw new TestRollbackSentinel(executionResult);
    });
  } catch (err: unknown) {
    if (err instanceof TestRollbackSentinel) {
      return err.result as T;
    }
    throw err;
  }

  return executionResult!;
}
