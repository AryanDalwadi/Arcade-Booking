import { createClient, RedisClientType } from 'redis';

export class RedisAdapter {
  private readonly client: RedisClientType;
  constructor(url: string) {
    this.client = createClient({ url });
    this.client.on('error', (error) => console.error('Redis error', error.message));
  }
  async connect(): Promise<void> { if (!this.client.isOpen) await this.client.connect(); }
  async get(key: string): Promise<string | null> {
    try {
      if (!this.client.isReady) return null;
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get failed open', error instanceof Error ? error.message : error);
      return null;
    }
  }
  async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    try {
      if (!this.client.isReady) return;
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch (error) {
      console.error('Redis set failed open', error instanceof Error ? error.message : error);
    }
  }
  async delete(key: string): Promise<void> {
    try {
      if (!this.client.isReady) return;
      await this.client.del(key);
    } catch (error) {
      console.error('Redis delete failed open', error instanceof Error ? error.message : error);
    }
  }
  isReady(): boolean { return this.client.isReady; }
  async close(): Promise<void> { if (this.client.isOpen) await this.client.quit(); }
}

