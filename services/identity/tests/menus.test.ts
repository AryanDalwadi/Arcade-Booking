import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { identityRoutes } from '../src/application/context';
import { Postgres } from '../src/adapters/postgres';
import { parseEnv } from '../src/config/env';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];
const env = parseEnv({
  NODE_ENV: 'test',
  JWT_SECRET: 'identity-test-secret-with-32-characters',
});
const menuId = 'a1000000-0000-4000-8000-000000000010';
const parentId = 'a1000000-0000-4000-8000-000000000011';
const mainId = 'a1000000-0000-4000-8000-000000000012';

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))));
});

type Query = (sql: string, values?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

async function serve(query: Query, transaction?: Postgres['transaction']): Promise<string> {
  const db = {
    query,
    transaction: transaction ?? (async (work) => work({ query } as never)),
  } as unknown as Postgres;
  const app = createHttpApp({
    dbReady: async () => true,
    dependencyReady: () => true,
    routes: identityRoutes(db, env),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function menuRow(overrides: Record<string, unknown> = {}) {
  return {
    id: menuId,
    parent_id: null,
    label: 'Floor',
    icon: 'ic_floor',
    url: '/admin/floor',
    priority: 0,
    active: true,
    expandable: false,
    sys_admin: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const adminHeaders = {
  'content-type': 'application/json',
  'x-auth-subject': '10000000-0000-4000-8000-000000000001',
  'x-auth-roles': 'ADMIN',
};

describe('menu administration', () => {
  it('defaults a new main menu to sys admin', async () => {
    let inserted: readonly unknown[] = [];
    const origin = await serve(async (sql, values = []) => {
      if (sql.includes('WHERE url = $1')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO menus')) {
        inserted = values;
        return {
          rows: [menuRow({
            label: values[1],
            icon: values[2],
            url: values[3],
            priority: values[4],
            active: values[5],
            expandable: values[6],
            sys_admin: values[7],
          })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await fetch(`${origin}/v1/menus`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        label: 'Floor',
        icon: 'ic_floor',
        url: '/admin/floor',
        priority: 4,
      }),
    });

    expect(response.status).toBe(201);
    expect(inserted[5]).toBe(true);
    expect(inserted[6]).toBe(false);
    expect(inserted[7]).toBe(true);
    expect(await response.json()).toMatchObject({
      data: { label: 'Floor', sysAdmin: true, expandable: false, active: true },
    });
  });

  it('rejects a submenu unless its main menu is expandable', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('WHERE url = $1')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH RECURSIVE')) {
        return {
          rows: [{ id: parentId, parent_id: null, expandable: false }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/menus`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        parentId,
        label: 'Night shift',
        icon: 'ic_night',
        url: '/admin/night',
        priority: 1,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'MENU_NOT_EXPANDABLE' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menus'))).toBe(false);
  });

  it('accepts a submenu nested under an expandable main menu', async () => {
    let inserted: readonly unknown[] = [];
    const origin = await serve(async (sql, values = []) => {
      if (sql.includes('WHERE url = $1')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH RECURSIVE')) {
        return {
          rows: [
            { id: parentId, parent_id: mainId, expandable: false },
            { id: mainId, parent_id: null, expandable: true },
          ],
          rowCount: 2,
        };
      }
      if (sql.includes('INSERT INTO menus')) {
        inserted = values;
        return {
          rows: [menuRow({
            parent_id: values[0],
            label: values[1],
            expandable: values[6],
            sys_admin: values[7],
          })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await fetch(`${origin}/v1/menus`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        parentId,
        label: 'Night shift',
        icon: 'ic_night',
        url: '/admin/night',
        priority: 2,
      }),
    });

    expect(response.status).toBe(201);
    expect(inserted[0]).toBe(parentId);
    expect(inserted[6]).toBe(false);
  });

  it('replaces menu rights for one role', async () => {
    const sqls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      sqls.push(sql);
      if (sql.includes('WHERE url = $1')) return { rows: [], rowCount: 0 };
      if (sql.includes('ANY($1::uuid[])')) return { rows: [{ id: menuId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/menu-rights`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        role: 'STAFF',
        rights: [{
          menuId,
          canAll: false,
          canAdd: false,
          canDelete: false,
          canEdit: false,
          canDetails: true,
        }],
      }),
    });

    expect(response.status).toBe(200);
    expect(sqls.some((sql) => sql.includes('DELETE FROM menu_rights'))).toBe(true);
    expect(sqls.some((sql) => sql.includes('INSERT INTO menu_rights'))).toBe(true);
    expect(await response.json()).toMatchObject({
      data: {
        role: 'STAFF',
        rights: [{ menuId, canDetails: true, canAdd: false, canAll: false }],
      },
    });
  });

  it('hides every menu from STAFF until a right is saved', async () => {
    const usersMenu = menuRow({
      id: 'a1000000-0000-4000-8000-000000000002',
      label: 'Users',
      url: '/admin/users',
      sys_admin: true,
    });
    const origin = await serve(async (sql) => {
      if (sql.includes('active = true')) return { rows: [usersMenu], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const hidden = await fetch(`${origin}/v1/menus/access`, {
      headers: { 'x-auth-subject': 'staff-1', 'x-auth-roles': 'STAFF' },
    });
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ success: true, data: [] });
  });

  it('returns a menu to STAFF after details access is granted', async () => {
    const usersMenu = menuRow({
      id: 'a1000000-0000-4000-8000-000000000002',
      label: 'Users',
      url: '/admin/users',
      sys_admin: true,
    });
    const origin = await serve(async (sql) => {
      if (sql.includes('active = true')) return { rows: [usersMenu], rowCount: 1 };
      if (sql.includes('FROM menu_rights')) {
        return {
          rows: [{
            menu_id: usersMenu.id,
            role: 'STAFF',
            can_all: false,
            can_add: false,
            can_delete: false,
            can_edit: false,
            can_details: true,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const visible = await fetch(`${origin}/v1/menus/access`, {
      headers: { 'x-auth-subject': 'staff-1', 'x-auth-roles': 'STAFF' },
    });
    expect(visible.status).toBe(200);
    expect(await visible.json()).toMatchObject({
      data: [{ url: '/admin/users', canDetails: true, canAdd: false }],
    });
  });
});
