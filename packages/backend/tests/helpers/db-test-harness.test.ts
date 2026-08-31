import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { runTestInRollback } from './db-test-harness';
import { sql } from '../../src/db/client';

describe('Database Test Harness: runTestInRollback', () => {
  beforeAll(async () => {
    // Create test table
    await sql`DROP TABLE IF EXISTS harness_test_items`;
    await sql`
      CREATE TABLE IF NOT EXISTS harness_test_items (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00
      )
    `;
  });

  afterAll(async () => {
    await sql`DROP TABLE IF EXISTS harness_test_items`;
  });

  it('executes query inside transaction and returns the result', async () => {
    const result = await runTestInRollback(async (tx) => {
      await tx`
        INSERT INTO harness_test_items (id, name, amount)
        VALUES ('item-1', 'Test Item 1', 150000.00)
      `;

      const rows = await tx`
        SELECT id, name, amount FROM harness_test_items WHERE id = 'item-1'
      `;
      return rows;
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Test Item 1');
  });

  it('guarantees data is rolled back and not persisted in database', async () => {
    // Verify before: item-1 does not exist in db
    const beforeCheck = await sql`
      SELECT id FROM harness_test_items WHERE id = 'item-1'
    `;
    expect(beforeCheck.length).toBe(0);

    // Insert inside rollback harness
    await runTestInRollback(async (tx) => {
      await tx`
        INSERT INTO harness_test_items (id, name, amount)
        VALUES ('item-rollback-check', 'Temporary Item', 50000.00)
      `;

      const inTx = await tx`
        SELECT id FROM harness_test_items WHERE id = 'item-rollback-check'
      `;
      expect(inTx.length).toBe(1);
    });

    // Verify after: item-rollback-check must NOT exist in db
    const afterCheck = await sql`
      SELECT id FROM harness_test_items WHERE id = 'item-rollback-check'
    `;
    expect(afterCheck.length).toBe(0);
  });

  it('propagates errors thrown inside callback while still rolling back', async () => {
    let errorCaught = false;

    try {
      await runTestInRollback(async (tx) => {
        await tx`
          INSERT INTO harness_test_items (id, name, amount)
          VALUES ('item-error-check', 'Should Be Rolled Back', 99000.00)
        `;
        throw new Error('Simulated business error inside test');
      });
    } catch (err: unknown) {
      errorCaught = true;
      if (err instanceof Error) {
        expect(err.message).toBe('Simulated business error inside test');
      }
    }

    expect(errorCaught).toBe(true);

    // Verify after error: data must NOT exist
    const afterErrorCheck = await sql`
      SELECT id FROM harness_test_items WHERE id = 'item-error-check'
    `;
    expect(afterErrorCheck.length).toBe(0);
  });

  it('ensures consecutive tests are fully isolated', async () => {
    await runTestInRollback(async (tx) => {
      await tx`
        INSERT INTO harness_test_items (id, name, amount)
        VALUES ('isolated-1', 'Item 1', 1000.00)
      `;
    });

    await runTestInRollback(async (tx) => {
      const rows = await tx`
        SELECT id FROM harness_test_items WHERE id = 'isolated-1'
      `;
      expect(rows.length).toBe(0);
    });
  });
});
