import { sql, type TransactionClient } from './client';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MigrationResult {
  migrationName: string;
  success: boolean;
  statementsExecuted: number;
  error?: string;
}

/**
 * Splits raw SQL content into individual executable statements,
 * correctly preserving dollar-quoted blocks ($$ ... $$) and ignoring comments.
 */
export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sqlText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inDollarQuote && (trimmed.startsWith('--') || trimmed === '')) {
      continue;
    }

    // Check for dollar quote delimiters like $$ or $tag$
    const dollarMatches = line.match(/\$[a-zA-Z0-9_]*\$/g);
    if (dollarMatches) {
      for (const match of dollarMatches) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = match;
        } else if (match === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }

    current += line + '\n';

    if (!inDollarQuote && trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

export async function runMigrations(customSql?: TransactionClient): Promise<MigrationResult[]> {
  const db = customSql || sql;
  const results: MigrationResult[] = [];

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Ensure migration tracking table exists
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );
  `);

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');

    // Check if migration has already been executed
    const existing = await db`
      SELECT version FROM schema_migrations WHERE version = ${version}
    `;

    if (existing.length > 0) {
      console.log(`[Migration] Skipping ${file} (already applied)`);
      continue;
    }

    const filePath = join(migrationsDir, file);
    const sqlContent = readFileSync(filePath, 'utf-8');
    const statements = splitSqlStatements(sqlContent);

    console.log(`[Migration] Executing ${file} (${statements.length} statements)...`);
    try {
      for (const statement of statements) {
        await db.unsafe(statement);
      }

      // Record migration version
      await db`
        INSERT INTO schema_migrations (version) VALUES (${version})
      `;

      results.push({ migrationName: file, success: true, statementsExecuted: statements.length });
      console.log(`[Migration] Successfully applied ${file}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Migration] Error applying ${file}:`, errorMsg);
      results.push({ migrationName: file, success: false, statementsExecuted: 0, error: errorMsg });
      throw new Error(`Migration ${file} failed: ${errorMsg}`);
    }
  }

  return results;
}

// Allow direct CLI execution
if (import.meta.main) {
  runMigrations()
    .then(() => {
      console.log('[Migration] All migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Migration process failed:', err);
      process.exit(1);
    });
}
