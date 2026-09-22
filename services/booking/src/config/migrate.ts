import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from '@arcade/observability';
import { env } from './env';
import { Postgres } from '../adapters/postgres';

async function main() {
  const db = new Postgres(env.DATABASE_URL);
  const directory = path.resolve(__dirname, '../../migrations');
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  try {
    for (const file of files) {
      await db.query(await fs.readFile(path.join(directory, file), 'utf8'));
      log('info', 'migrate.apply', { service: 'booking', file });
    }
  } finally { await db.close(); }
}
void main().catch((error) => {
  log('error', 'migrate.failed', {
    service: 'booking',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
