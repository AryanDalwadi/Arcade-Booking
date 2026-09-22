import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { Postgres } from '../adapters/postgres';

async function main() {
  const db = new Postgres(env.DATABASE_URL);
  const directory = path.resolve(__dirname, '../../migrations');
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  try {
    for (const file of files) {
      await db.query(await fs.readFile(path.join(directory, file), 'utf8'));
      console.log('applied', file);
    }
  } finally { await db.close(); }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });

