import { createClient, RedisClientType } from 'redis';

export class RedisAdapter {
  private readonly client: RedisClientType;
  constructor(url: string) {
    this.client = createClient({ url });
    this.client.on('error', (error) => console.error('Redis error', error.message));
  }
  async connect(): Promise<void> { if (!this.client.isOpen) await this.client.connect(); }
  async get(key: string): Promise<string | null> { return this.client.get(key); }
  async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }
  isReady(): boolean { return this.client.isReady; }
  async close(): Promise<void> { if (this.client.isOpen) await this.client.quit(); }
}

