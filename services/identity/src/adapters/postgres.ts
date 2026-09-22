import { Pool, PoolClient, QueryResultRow } from 'pg';

export class Postgres {
  readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 3_000 });
  }
  query<T extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
    return this.pool.query<T>(text, [...values]);
  }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async ready(): Promise<boolean> {
    try { await this.pool.query('SELECT 1'); return true; } catch { return false; }
  }
  close() { return this.pool.end(); }
}

