const fs = require('fs');
const path = require('path');
const { connectPool, getPool, closePool } = require('../src/config/db');
const logger = require('../src/logger/logger');

const MIGRATION_FOLDERS = ['functions', 'tables', 'stored_procedures'];

const splitSqlBatches = (sqlContent) => {
  return sqlContent
    .split(/\r?\n\s*GO\s*\r?\n/i)
    .map((batch) => batch.trim())
    .filter(Boolean);
};

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

  for (const { label, filePath } of files) {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const batches = splitSqlBatches(sqlContent);

    logger.info(`Running migration: ${label}`);

    for (const batch of batches) {
      await pool.request().query(batch);
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
