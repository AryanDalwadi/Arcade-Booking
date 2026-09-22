import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMachines } from './catalogSlice';
import { makeStore } from '../store';

describe('catalog async flow', () => {
  beforeEach(() => localStorage.setItem('arcade.auth.token', 'test-token'));

  it('loads machines from the gateway into Redux', async () => {
    const machines = [{
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Neon Racer',
      status: 'ACTIVE',
    }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: machines,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const store = makeStore();

    await store.dispatch(fetchMachines());

    expect(store.getState().catalog).toMatchObject({ status: 'succeeded', machines });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/catalog/machines',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });
});
