import { SQL } from 'bun';

export const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return 'postgres://nusaproc:secret@172.17.0.4:5432/nusaproc_db?sslmode=disable';
};

export const sql = new SQL(getDatabaseUrl());

export type TransactionClient = typeof sql;

export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return await sql.begin(async (tx) => {
    return await callback(tx as TransactionClient);
  });
}
