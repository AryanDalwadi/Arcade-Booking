import { Router, type Request, type Response } from 'express';
import {
  createMenuSchema,
  menuIdParamSchema,
  menuRightsQuerySchema,
  replaceMenuRightsSchema,
  updateMenuSchema,
  type UserRole,
} from '@arcade/contracts';
import { readAuthContext, requireAuth } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

const MENUS_SCREEN = '/admin/menus';
const RIGHTS_SCREEN = '/admin/menu-rights';
const MENU_COLUMNS = 'id, parent_id, label, icon, url, priority, active, expandable, sys_admin, created_at';

type MenuAction = 'add' | 'delete' | 'edit' | 'details';
type MenuRow = {
  id: string;
  parent_id: string | null;
  label: string;
  icon: string;
  url: string;
  priority: number;
  active: boolean;
  expandable: boolean;
  sys_admin: boolean;
  created_at: Date;
};
type RightRow = {
  menu_id: string;
  role: UserRole;
  can_all: boolean;
  can_add: boolean;
  can_delete: boolean;
  can_edit: boolean;
  can_details: boolean;
};
type Flags = {
  canAll: boolean;
  canAdd: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canDetails: boolean;
};

const emptyFlags = (): Flags => ({
  canAll: false,
  canAdd: false,
  canDelete: false,
  canEdit: false,
  canDetails: false,
});

const fullFlags = (): Flags => ({
  canAll: true,
  canAdd: true,
  canDelete: true,
  canEdit: true,
  canDetails: true,
});

export function menuRoutes(db: Postgres): Router {
  const router = Router();

  router.get('/menus/access', requireAuth, async (req, res) => {
    const context = readAuthContext(req);
    if (!context) return unauthorized(res);
    const menus = await loadMenus(db, true);
    const rights = await loadRights(db, [...context.roles]);
    const visible = resolveAccess(menus, rights, context.roles);
    return res.json({ success: true, data: visible.map(publicAccess) });
  });

  router.get('/menus', requireAuth, async (req, res) => {
    if (!(await allowScreen(db, req, MENUS_SCREEN, 'details'))) return denied(res);
    const menus = await loadMenus(db, false);
    return res.json({ success: true, data: menus.map(publicMenu) });
  });

  router.post('/menus', requireAuth, async (req, res) => {
    if (!(await allowScreen(db, req, MENUS_SCREEN, 'add'))) return denied(res);
    const input = createMenuSchema.parse(req.body);
    const parentId = input.parentId ?? null;
    const parentError = await validateParent(db, parentId, null);
    if (parentError) return res.status(parentError.status).json(parentError.body);
    const result = await db.query<MenuRow>(
      `INSERT INTO menus(parent_id, label, icon, url, priority, active, expandable, sys_admin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${MENU_COLUMNS}`,
      [
        parentId,
        input.label,
        input.icon,
        input.url,
        input.priority,
        input.active ?? true,
        parentId ? false : input.expandable ?? false,
        input.sysAdmin ?? true,
      ],
    );
    const created = result.rows[0];
    if (!created) {
      return res.status(500).json({ success: false, message: 'Could not create menu', code: 'MENU_CREATE_FAILED' });
    }
    return res.status(201).json({ success: true, data: publicMenu(created) });
  });

  router.patch('/menus/:id', requireAuth, async (req, res) => {
    if (!(await allowScreen(db, req, MENUS_SCREEN, 'edit'))) return denied(res);
    const { id } = menuIdParamSchema.parse(req.params);
    const input = updateMenuSchema.parse(req.body);
    const existing = await loadMenu(db, id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Menu was not found', code: 'MENU_NOT_FOUND' });
    }
    const nextParent = input.parentId === undefined ? existing.parent_id : input.parentId;
    const parentError = await validateParent(db, nextParent, id);
    if (parentError) return res.status(parentError.status).json(parentError.body);
    const nextExpandable = nextParent ? false : input.expandable ?? existing.expandable;
    if (!nextParent && !nextExpandable) {
      const children = await db.query('SELECT 1 FROM menus WHERE parent_id = $1 LIMIT 1', [id]);
      if (children.rowCount) {
        return res.status(409).json({
          success: false,
          message: 'Remove submenus before turning off Expandable',
          code: 'MENU_HAS_CHILDREN',
        });
      }
    }
    const result = await db.query<MenuRow>(
      `UPDATE menus
       SET parent_id = $2, label = $3, icon = $4, url = $5, priority = $6,
           active = $7, expandable = $8, sys_admin = $9
       WHERE id = $1
       RETURNING ${MENU_COLUMNS}`,
      [
        id,
        nextParent,
        input.label ?? existing.label,
        input.icon ?? existing.icon,
        input.url ?? existing.url,
        input.priority ?? existing.priority,
        input.active ?? existing.active,
        nextExpandable,
        input.sysAdmin ?? existing.sys_admin,
      ],
    );
    const updated = result.rows[0];
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Menu was not found', code: 'MENU_NOT_FOUND' });
    }
    return res.json({ success: true, data: publicMenu(updated) });
  });

  router.delete('/menus/:id', requireAuth, async (req, res) => {
    if (!(await allowScreen(db, req, MENUS_SCREEN, 'delete'))) return denied(res);
    const { id } = menuIdParamSchema.parse(req.params);
    const removed = await db.query('DELETE FROM menus WHERE id = $1', [id]);
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Menu was not found', code: 'MENU_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  router.get('/menu-rights', requireAuth, async (req, res) => {
    if (!(await allowScreen(db, req, RIGHTS_SCREEN, 'details'))) return denied(res);
    const { role } = menuRightsQuerySchema.parse(req.query);
    const rights = await db.query<RightRow>(
      `SELECT menu_id, role, can_all, can_add, can_delete, can_edit, can_details
       FROM menu_rights WHERE role = $1`,
      [role],
    );
    return res.json({
      success: true,
      data: { role, rights: rights.rows.map(publicRight) },
    });
  });

  router.put('/menu-rights', requireAuth, async (req, res) => {
    if (!(await allowScreen(db, req, RIGHTS_SCREEN, 'edit'))) return denied(res);
    const input = replaceMenuRightsSchema.parse(req.body);
    const ids = [...new Set(input.rights.map((right) => right.menuId))];
    if (ids.length > 0) {
      const found = await db.query<{ id: string }>(
        'SELECT id FROM menus WHERE id = ANY($1::uuid[])',
        [ids],
      );
      if (found.rows.length !== ids.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more menus were not found',
          code: 'MENU_NOT_FOUND',
        });
      }
    }
    const stored = await db.transaction(async (client) => {
      await client.query('DELETE FROM menu_rights WHERE role = $1', [input.role]);
      const saved: RightRow[] = [];
      for (const right of input.rights) {
        const flags = normalizeFlags(right);
        if (!anyFlag(flags)) continue;
        await client.query(
          `INSERT INTO menu_rights(menu_id, role, can_all, can_add, can_delete, can_edit, can_details)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [right.menuId, input.role, flags.canAll, flags.canAdd, flags.canDelete, flags.canEdit, flags.canDetails],
        );
        saved.push({
          menu_id: right.menuId,
          role: input.role,
          can_all: flags.canAll,
          can_add: flags.canAdd,
          can_delete: flags.canDelete,
          can_edit: flags.canEdit,
          can_details: flags.canDetails,
        });
      }
      return saved;
    });
    return res.json({ success: true, data: { role: input.role, rights: stored.map(publicRight) } });
  });

  return router;
}

async function loadMenus(db: Postgres, activeOnly: boolean): Promise<MenuRow[]> {
  const result = await db.query<MenuRow>(
    `SELECT ${MENU_COLUMNS} FROM menus ${activeOnly ? 'WHERE active = true' : ''} ORDER BY priority, label`,
  );
  return result.rows;
}

async function loadMenu(db: Postgres, id: string): Promise<MenuRow | null> {
  const result = await db.query<MenuRow>(
    `SELECT ${MENU_COLUMNS} FROM menus WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function loadRights(db: Postgres, roles: string[]): Promise<RightRow[]> {
  if (roles.length === 0) return [];
  const result = await db.query<RightRow>(
    `SELECT menu_id, role, can_all, can_add, can_delete, can_edit, can_details
     FROM menu_rights WHERE role = ANY($1::text[])`,
    [roles],
  );
  return result.rows;
}

async function allowScreen(db: Postgres, req: Request, url: string, action: MenuAction): Promise<boolean> {
  const context = readAuthContext(req);
  if (!context) return false;
  const screen = await db.query<MenuRow>(
    `SELECT ${MENU_COLUMNS} FROM menus WHERE url = $1 LIMIT 1`,
    [url],
  );
  const menu = screen.rows[0];
  if (!menu) return context.roles.has('ADMIN');
  if (context.roles.has('ADMIN') && menu.sys_admin) return true;
  const rights = await loadRights(db, [...context.roles]);
  return rights.some((right) => right.menu_id === menu.id && grants(flagsFromRow(right), action));
}

async function validateParent(db: Postgres, parentId: string | null, selfId: string | null) {
  if (!parentId) return null;
  const chain = await db.query<{ id: string; parent_id: string | null; expandable: boolean }>(
    `WITH RECURSIVE chain AS (
       SELECT id, parent_id, expandable FROM menus WHERE id = $1
       UNION ALL
       SELECT m.id, m.parent_id, m.expandable
       FROM menus m
       INNER JOIN chain c ON m.id = c.parent_id
     )
     SELECT id, parent_id, expandable FROM chain`,
    [parentId],
  );
  if (chain.rows.length === 0) {
    return {
      status: 404,
      body: { success: false, message: 'Parent menu was not found', code: 'MENU_PARENT_NOT_FOUND' },
    };
  }
  if (selfId && chain.rows.some((row) => row.id === selfId)) {
    return {
      status: 400,
      body: { success: false, message: 'A menu cannot be nested under itself', code: 'MENU_CYCLE' },
    };
  }
  const root = chain.rows.find((row) => row.parent_id === null);
  if (!root?.expandable) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Submenus can only be created under an expandable main menu',
        code: 'MENU_NOT_EXPANDABLE',
      },
    };
  }
  return null;
}

function resolveAccess(menus: MenuRow[], rights: RightRow[], roles: ReadonlySet<UserRole>) {
  const rightsByMenu = new Map<string, RightRow[]>();
  for (const right of rights) {
    const list = rightsByMenu.get(right.menu_id) ?? [];
    list.push(right);
    rightsByMenu.set(right.menu_id, list);
  }
  const granted = new Map<string, Flags>();
  for (const menu of menus) {
    if (!menu.active) continue;
    let flags = emptyFlags();
    if (roles.has('ADMIN') && menu.sys_admin) {
      flags = fullFlags();
    } else {
      for (const right of rightsByMenu.get(menu.id) ?? []) {
        if (!roles.has(right.role)) continue;
        flags = mergeFlags(flags, flagsFromRow(right));
      }
    }
    if (anyFlag(flags)) granted.set(menu.id, flags);
  }
  const byId = new Map(menus.map((menu) => [menu.id, menu]));
  const include = new Set(granted.keys());
  for (const id of granted.keys()) {
    let parentId = byId.get(id)?.parent_id ?? null;
    while (parentId) {
      include.add(parentId);
      parentId = byId.get(parentId)?.parent_id ?? null;
    }
  }
  return menus
    .filter((menu) => menu.active && include.has(menu.id))
    .map((menu) => ({ menu, flags: granted.get(menu.id) ?? emptyFlags() }));
}

function flagsFromRow(row: RightRow): Flags {
  return normalizeFlags({
    canAll: row.can_all,
    canAdd: row.can_add,
    canDelete: row.can_delete,
    canEdit: row.can_edit,
    canDetails: row.can_details,
  });
}

function normalizeFlags(flags: Flags): Flags {
  const canAdd = flags.canAll || flags.canAdd;
  const canDelete = flags.canAll || flags.canDelete;
  const canEdit = flags.canAll || flags.canEdit;
  const canDetails = flags.canAll || flags.canDetails;
  return {
    canAll: canAdd && canDelete && canEdit && canDetails,
    canAdd,
    canDelete,
    canEdit,
    canDetails,
  };
}

function mergeFlags(left: Flags, right: Flags): Flags {
  return normalizeFlags({
    canAll: left.canAll || right.canAll,
    canAdd: left.canAdd || right.canAdd,
    canDelete: left.canDelete || right.canDelete,
    canEdit: left.canEdit || right.canEdit,
    canDetails: left.canDetails || right.canDetails,
  });
}

function anyFlag(flags: Flags): boolean {
  return flags.canAdd || flags.canDelete || flags.canEdit || flags.canDetails;
}

function grants(flags: Flags, action: MenuAction): boolean {
  if (action === 'add') return flags.canAdd;
  if (action === 'delete') return flags.canDelete;
  if (action === 'edit') return flags.canEdit;
  return flags.canDetails;
}

function publicMenu(row: MenuRow) {
  return {
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    icon: row.icon,
    url: row.url,
    priority: row.priority,
    active: row.active,
    expandable: row.expandable,
    sysAdmin: row.sys_admin,
    createdAt: row.created_at.toISOString(),
  };
}

function publicRight(row: RightRow) {
  const flags = flagsFromRow(row);
  return { menuId: row.menu_id, role: row.role, ...flags };
}

function publicAccess(entry: { menu: MenuRow; flags: Flags }) {
  return { ...publicMenu(entry.menu), ...entry.flags };
}

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    message: 'Verified user context is required',
    code: 'AUTH_CONTEXT_REQUIRED',
  });
}

function denied(res: Response) {
  return res.status(403).json({
    success: false,
    message: 'You do not have access to this menu',
    code: 'MENU_ACCESS_DENIED',
  });
}
