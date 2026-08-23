import { SQL } from 'bun';

export const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'sqlite::memory:';
  }
  return 'postgres://nusaproc:secret@localhost:5432/nusaproc_db';
};

export const sql = new SQL({
  url: getDatabaseUrl(),
  max: 20,
  idleTimeout: 30,
  tls: process.env.NODE_ENV === 'production',
});

export type TransactionClient = typeof sql;

export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return await sql.begin(async (tx) => {
    return await callback(tx as TransactionClient);
  });
}
