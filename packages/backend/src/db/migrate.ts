// ========================================================================
// Database Migration Engine
// Discovers and runs SQL migrations in numerical order against Supabase / PostgreSQL
// ========================================================================

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { env } from '../config/env.js';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.resolve(process.cwd(), 'src/db');

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  error?: string;
}

export async function runMigrations(dbUrl?: string): Promise<MigrationResult> {
  const connectionString = dbUrl || env.DATABASE_URL;

  if (!connectionString || connectionString.includes('postgres.xxx')) {
    const msg = 'DATABASE_URL is not configured with a valid database connection string. Please update .env with your Supabase credentials.';
    console.error(`\x1b[31m[Migration Error]\x1b[0m ${msg}`);
    return { applied: [], skipped: [], error: msg };
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    console.log('\x1b[36m[Migration Engine]\x1b[0m Connecting to Supabase / PostgreSQL...');
    
    // 1. Ensure migrations ledger exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Query executed migrations
    const res = await client.query<{ name: string }>('SELECT name FROM _schema_migrations ORDER BY id ASC');
    const executed = new Set(res.rows.map((r) => r.name));

    // 3. Find migration files
    const candidateDirs = [
      path.resolve(currentDir, 'migrations'),
      path.resolve(currentDir, '../../src/db/migrations'),
      path.resolve(process.cwd(), 'src/db/migrations'),
      path.resolve(process.cwd(), 'packages/backend/src/db/migrations'),
    ];
    const migrationsDir = candidateDirs.find((d) => fs.existsSync(d));
    if (!migrationsDir) {
      throw new Error(`Migrations directory not found in: ${candidateDirs.join(', ')}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    console.log(`\x1b[36m[Migration Engine]\x1b[0m Found ${files.length} migration scripts.`);

    // 4. Run unapplied migrations sequentially
    for (const file of files) {
      if (executed.has(file)) {
        skipped.push(file);
        continue;
      }

      console.log(`\x1b[33m[Migrating]\x1b[0m Applying ${file}...`);
      const startTime = Date.now();
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        const duration = Date.now() - startTime;
        applied.push(file);
        console.log(`\x1b[32m[Migrated]\x1b[0m Successfully applied ${file} (${duration}ms)`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`\x1b[31m[Migration Failed]\x1b[0m Error applying ${file}:`, err.message);
        throw err;
      }
    }

    console.log(`\x1b[32m[Migration Summary]\x1b[0m ${applied.length} new migrations applied, ${skipped.length} up to date.`);
    return { applied, skipped };
  } finally {
    client.release();
    await pool.end();
  }
}

// Direct CLI execution
if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations()
    .then((result) => {
      if (result.error) {
        process.exit(1);
      }
      console.log('\x1b[32m[Migration Engine]\x1b[0m Migration process completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\x1b[31m[Migration Engine Fatal]\x1b[0m', err);
      process.exit(1);
    });
}
