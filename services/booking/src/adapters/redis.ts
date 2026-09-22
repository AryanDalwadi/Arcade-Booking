import { createClient, RedisClientType } from 'redis';

const acquireSlotsScript = `
for i = 1, #KEYS do
  if redis.call('EXISTS', KEYS[i]) == 1 then
    return 0
  end
end
for i = 1, #KEYS do
  redis.call('SET', KEYS[i], ARGV[1], 'EX', tonumber(ARGV[2]))
end
return 1
`;

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
  /**
   * Claims every slot key or none. Redis down → true so PostgreSQL/Inventory
   * still decide the slot instead of failing the HTTP booking.
   */
  async acquire(key: string | string[], value: string, ttlSeconds: number): Promise<boolean> {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return true;
    try {
      if (!this.client.isReady) return true;
      const result = await this.client.sendCommand([
        'EVAL',
        acquireSlotsScript,
        String(keys.length),
        ...keys,
        value,
        String(ttlSeconds),
      ]);
      return Number(result) === 1;
    } catch (error) {
      console.error('Redis hold failed open', error instanceof Error ? error.message : error);
      return true;
    }
  }
  async delete(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return;
    try {
      if (!this.client.isReady) return;
      await this.client.del(keys);
    } catch (error) {
      console.error('Redis delete failed open', error instanceof Error ? error.message : error);
    }
  }
  isReady(): boolean { return this.client.isReady; }
  async close(): Promise<void> { if (this.client.isOpen) await this.client.quit(); }
}

