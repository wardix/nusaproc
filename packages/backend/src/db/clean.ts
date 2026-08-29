import { sql } from './client';

export async function cleanDatabase(): Promise<{ success: boolean; message: string }> {
  console.log('[Clean] Membersihkan seluruh data dari database NusaProc...');

  // Query all base tables in current schema except migration metadata tables
  const rows = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = current_schema() 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('schema_migrations', '_migrations', 'tax_rule_snapshot');
  `;

  if (rows.length > 0) {
    const tableNames = rows.map((r: { table_name: string }) => `"${r.table_name}"`).join(', ');
    await sql.unsafe(`TRUNCATE TABLE ${tableNames} CASCADE;`);
  }

  console.log('[Clean] Seluruh data transaksi, master, dan akun pengguna berhasil dibersihkan! ✨');
  return { success: true, message: 'Database cleaned successfully.' };
}

if (import.meta.main) {
  cleanDatabase()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Clean] Gagal membersihkan database:', err);
      process.exit(1);
    });
}
