import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { Router } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))));
});

describe('booking health probes', () => {
  it('stays live and becomes unready while shutting down', async () => {
    let acceptingTraffic = true;
    const app = createHttpApp({
      dbReady: async () => true,
      dependencyReady: () => true,
      acceptingTraffic: () => acceptingTraffic,
      routes: Router(),
    });
    const server = createServer(app).listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    expect((await fetch(`${origin}/health/live`)).status).toBe(200);
    expect((await fetch(`${origin}/health/ready`)).status).toBe(200);

    acceptingTraffic = false;
    expect((await fetch(`${origin}/health/live`)).status).toBe(200);
    const ready = await fetch(`${origin}/health/ready`);
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ status: 'not_ready', checks: { shuttingDown: true } });
  });
});
