const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connectPool, getPool, closePool } = require('../src/config/db');
const logger = require('../src/logger/logger');

const MIGRATION_FOLDERS = ['functions', 'tables', 'stored_procedures'];

const checksum = (content) =>
  crypto.createHash('sha256').update(content).digest('hex');

const collectMigrationFiles = (migrationsDir) => {
  const files = [];

  for (const folder of MIGRATION_FOLDERS) {
    const folderPath = path.join(migrationsDir, folder);

    if (!fs.existsSync(folderPath)) {
      continue;
    }

    const folderFiles = fs
      .readdirSync(folderPath)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => ({
        label: `${folder}/${file}`,
        filePath: path.join(folderPath, file),
      }));

    files.push(...folderFiles);
  }

  return files;
};

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = collectMigrationFiles(migrationsDir);

  if (files.length === 0) {
    logger.warn('No migration files found');
    return;
  }

  await connectPool();
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      migration_name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const appliedResult = await pool.query(
    'SELECT migration_name, checksum FROM public.schema_migrations'
  );
  const applied = new Map(
    appliedResult.rows.map((row) => [row.migration_name, row.checksum])
  );

  for (const { label, filePath } of files) {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const migrationChecksum = checksum(sqlContent);
    const existingChecksum = applied.get(label);

    if (existingChecksum) {
      if (existingChecksum !== migrationChecksum) {
        throw new Error(`Previously applied migration was modified: ${label}`);
      }
      logger.info(`Skipping applied migration: ${label}`);
      continue;
    }

    logger.info(`Running migration: ${label}`);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query(
        `INSERT INTO public.schema_migrations (migration_name, checksum)
         VALUES ($1, $2)`,
        [label, migrationChecksum]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    logger.info(`Completed migration: ${label}`);
  }
};

runMigrations()
  .then(async () => {
    await closePool();
    logger.info('All migrations completed successfully');
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('Migration failed', { message: error.message });
    await closePool().catch(() => {});
    process.exit(1);
  });
