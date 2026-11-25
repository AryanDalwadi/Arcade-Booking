import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Router } from 'express';
import {
  createUserAdminSchema,
  createUserGroupSchema,
  groupMembershipSchema,
  loginSchema,
  registerUserSchema,
  setUserGroupSchema,
  updateUserGroupSchema,
  updateUserSchema,
  userGroupIdParamSchema,
  userIdParamSchema,
  userRoleSchema,
} from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import { Env } from '../config/env';
import { menuRoutes } from './menus';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  roles: string[];
  active: boolean;
  group_id: string | null;
  group_name: string | null;
  created_at: Date;
};
type GroupRow = {
  id: string;
  name: string;
  system_admin: boolean;
  active: boolean;
  members: string[];
};
const roleFilter = "ug.name IN ('CUSTOMER','STAFF','ADMIN')";
const SYSTEM_GROUP_NAMES = new Set(['CUSTOMER', 'STAFF', 'ADMIN']);

function isReservedGroupName(name: string): boolean {
  return SYSTEM_GROUP_NAMES.has(name.toUpperCase()) || userRoleSchema.safeParse(name.toUpperCase()).success;
}

async function loadUserById(db: Postgres, id: string): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT u.id,u.email,u.display_name,u.password_hash,u.active,u.created_at,
     COALESCE(array_agg(DISTINCT ug.name) FILTER (WHERE ${roleFilter}), ARRAY['CUSTOMER']::text[]) roles,
     (SELECT m.group_id FROM user_group_members m WHERE m.user_id=u.id LIMIT 1) group_id,
     (SELECT g.name FROM user_group_members m JOIN user_groups g ON g.id=m.group_id WHERE m.user_id=u.id LIMIT 1) group_name
     FROM users u
     LEFT JOIN user_group_members m ON m.user_id=u.id
     LEFT JOIN user_groups ug ON ug.id=m.group_id
     WHERE u.id=$1
     GROUP BY u.id`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function bootstrapAdmin(db: Postgres, email?: string): Promise<boolean> {
  if (!email) return false;
  const result = await db.query<{ found: boolean }>(
    `WITH target AS (
       SELECT u.id user_id,ug.id group_id
       FROM users u CROSS JOIN user_groups ug
       WHERE u.email=$1 AND ug.name='ADMIN'
     ), inserted AS (
       INSERT INTO user_group_members(group_id,user_id)
       SELECT group_id,user_id FROM target
       ON CONFLICT DO NOTHING
     )
     SELECT EXISTS(SELECT 1 FROM target) found`,
    [email.toLowerCase()],
  );
  return result.rows[0]?.found ?? false;
}

export function identityRoutes(db: Postgres, env: Env): Router {
  const router = Router();
  router.use(menuRoutes(db));
  router.post('/auth/register', async (req, res) => {
    const input = registerUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await db.query<UserRow>(
      `WITH new_user AS (
         INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3)
         ON CONFLICT(email) DO NOTHING
         RETURNING id,email,display_name,password_hash,active,created_at
       ), membership AS (
         INSERT INTO user_group_members(group_id,user_id)
         SELECT ug.id,nu.id FROM user_groups ug CROSS JOIN new_user nu
         WHERE ug.name='CUSTOMER'
       )
       SELECT nu.id,nu.email,nu.display_name,nu.password_hash,nu.active,nu.created_at,
         ARRAY['CUSTOMER']::text[] roles,
         (SELECT ug.id FROM user_groups ug WHERE ug.name='CUSTOMER') group_id,
         'CUSTOMER'::text group_name
       FROM new_user nu`,
      [input.email.toLowerCase(), input.displayName, passwordHash],
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }
    res.status(201).json({ success: true, data: publicUser(user) });
  });
  router.post('/auth/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await db.query<UserRow>(
      `SELECT u.id,u.email,u.display_name,u.password_hash,u.active,u.created_at,
       COALESCE(array_agg(DISTINCT ug.name) FILTER (WHERE ${roleFilter}), ARRAY['CUSTOMER']::text[]) roles,
       (SELECT m.group_id FROM user_group_members m WHERE m.user_id=u.id LIMIT 1) group_id,
       (SELECT g.name FROM user_group_members m JOIN user_groups g ON g.id=m.group_id WHERE m.user_id=u.id LIMIT 1) group_name
       FROM users u LEFT JOIN user_group_members m ON m.user_id=u.id
       LEFT JOIN user_groups ug ON ug.id=m.group_id WHERE u.email=$1 GROUP BY u.id`,
      [input.email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Account is inactive', code: 'ACCOUNT_INACTIVE' });
    }
    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    };
    const token = jwt.sign({ sub: user.id, roles: user.roles, email: user.email }, env.JWT_SECRET, options);
    return res.json({ success: true, data: { token, user: publicUser(user) } });
  });
  router.get('/users', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const result = await db.query<UserRow>(
      `SELECT u.id,u.email,u.display_name,u.password_hash,u.active,u.created_at,
       COALESCE(array_agg(DISTINCT ug.name) FILTER (WHERE ${roleFilter}), ARRAY['CUSTOMER']::text[]) roles,
       (SELECT m.group_id FROM user_group_members m WHERE m.user_id=u.id LIMIT 1) group_id,
       (SELECT g.name FROM user_group_members m JOIN user_groups g ON g.id=m.group_id WHERE m.user_id=u.id LIMIT 1) group_name
       FROM users u
       LEFT JOIN user_group_members m ON m.user_id=u.id
       LEFT JOIN user_groups ug ON ug.id=m.group_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
    );
    res.json({ success: true, data: result.rows.map(publicUser) });
  });
  router.post('/users', requireAnyRole('ADMIN'), async (req, res) => {
    const input = createUserAdminSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const active = input.active ?? true;
    const result = await db.query<UserRow>(
      `INSERT INTO users(email,display_name,password_hash,active) VALUES($1,$2,$3,$4)
       ON CONFLICT(email) DO NOTHING
       RETURNING id,email,display_name,password_hash,active,created_at,
         ARRAY['CUSTOMER']::text[] roles,
         NULL::uuid group_id,
         NULL::text group_name`,
      [input.email.toLowerCase(), input.displayName, passwordHash, active],
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }
    return res.status(201).json({ success: true, data: publicUser(user) });
  });
  router.patch('/users/:id', requireAnyRole('ADMIN'), async (req, res) => {
    const { id } = userIdParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    const existing = await loadUserById(db, id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User was not found', code: 'USER_NOT_FOUND' });
    }
    const nextDisplayName = input.displayName ?? existing.display_name;
    const nextActive = input.active ?? existing.active;
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 12)
      : existing.password_hash;
    await db.query(
      `UPDATE users SET display_name=$2, active=$3, password_hash=$4 WHERE id=$1`,
      [id, nextDisplayName, nextActive, passwordHash],
    );
    const user = await loadUserById(db, id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User was not found', code: 'USER_NOT_FOUND' });
    }
    return res.json({ success: true, data: publicUser(user) });
  });
  router.put('/users/:id/group', requireAnyRole('ADMIN'), async (req, res) => {
    const { id } = userIdParamSchema.parse(req.params);
    const { groupId } = setUserGroupSchema.parse(req.body);
    const user = await loadUserById(db, id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User was not found', code: 'USER_NOT_FOUND' });
    }
    const outcome = await db.transaction(async (client) => {
      const group = await client.query<{ name: string }>(
        'SELECT name FROM user_groups WHERE id=$1',
        [groupId],
      );
      if (!group.rows[0]) return 'missing-group' as const;
      const adminGroup = await client.query<{ id: string }>(
        "SELECT id FROM user_groups WHERE name='ADMIN'",
      );
      const adminGroupId = adminGroup.rows[0]?.id;
      if (adminGroupId && user.group_id === adminGroupId && user.roles.includes('ADMIN')) {
        const count = await client.query<{ count: string }>(
          'SELECT count(*) count FROM user_group_members WHERE group_id=$1',
          [adminGroupId],
        );
        if (Number(count.rows[0]?.count ?? 0) <= 1 && groupId !== adminGroupId) {
          return 'last-admin' as const;
        }
      }
      await client.query('DELETE FROM user_group_members WHERE user_id=$1', [id]);
      await client.query(
        'INSERT INTO user_group_members(group_id,user_id) VALUES($1,$2)',
        [groupId, id],
      );
      return 'ok' as const;
    });
    if (outcome === 'missing-group') {
      return res.status(404).json({ success: false, message: 'User group was not found', code: 'GROUP_NOT_FOUND' });
    }
    if (outcome === 'last-admin') {
      return res.status(409).json({
        success: false,
        message: 'At least one administrator must remain',
        code: 'LAST_ADMIN_REQUIRED',
      });
    }
    const updated = await loadUserById(db, id);
    return res.json({ success: true, data: publicUser(updated!) });
  });
  router.delete('/users/:id', requireAnyRole('ADMIN'), async (req, res) => {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await loadUserById(db, id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User was not found', code: 'USER_NOT_FOUND' });
    }
    const blocked = await db.transaction(async (client) => {
      const adminGroup = await client.query<{ id: string }>(
        "SELECT id FROM user_groups WHERE name='ADMIN'",
      );
      const adminGroupId = adminGroup.rows[0]?.id;
      if (!adminGroupId || !user.roles.includes('ADMIN')) return false;
      const member = await client.query(
        'SELECT 1 FROM user_group_members WHERE group_id=$1 AND user_id=$2',
        [adminGroupId, id],
      );
      if (!member.rowCount) return false;
      const count = await client.query<{ count: string }>(
        'SELECT count(*) count FROM user_group_members WHERE group_id=$1',
        [adminGroupId],
      );
      return Number(count.rows[0]?.count ?? 0) <= 1;
    });
    if (blocked) {
      return res.status(409).json({
        success: false,
        message: 'At least one administrator must remain',
        code: 'LAST_ADMIN_REQUIRED',
      });
    }
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    return res.status(204).send();
  });
  router.get('/user-groups', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const result = await db.query<GroupRow>(
      `SELECT ug.id,ug.name,ug.system_admin,ug.active,
       COALESCE(array_agg(m.user_id) FILTER (WHERE m.user_id IS NOT NULL), ARRAY[]::uuid[]) members
       FROM user_groups ug
       LEFT JOIN user_group_members m ON m.group_id=ug.id
       GROUP BY ug.id, ug.name, ug.system_admin, ug.active
       ORDER BY ug.name`,
    );
    res.json({ success: true, data: result.rows.map(publicGroup) });
  });
  router.post('/user-groups', requireAnyRole('ADMIN'), async (req, res) => {
    const input = createUserGroupSchema.parse(req.body);
    if (isReservedGroupName(input.name)) {
      return res.status(409).json({
        success: false,
        message: 'System role groups already exist and cannot be recreated',
        code: 'SYSTEM_GROUP_RESERVED',
      });
    }
    const result = await db.query<GroupRow>(
      `INSERT INTO user_groups(name, system_admin, active) VALUES($1,$2,$3)
       RETURNING id,name,system_admin,active,ARRAY[]::uuid[] members`,
      [input.name, input.systemAdmin ?? false, input.active ?? true],
    );
    const created = result.rows[0];
    if (!created) {
      return res.status(500).json({ success: false, message: 'Could not create user group', code: 'GROUP_CREATE_FAILED' });
    }
    return res.status(201).json({ success: true, data: publicGroup(created) });
  });
  router.patch('/user-groups/:groupId', requireAnyRole('ADMIN'), async (req, res) => {
    const { groupId } = userGroupIdParamSchema.parse(req.params);
    const input = updateUserGroupSchema.parse(req.body);
    const existing = await db.query<{ name: string; system_admin: boolean; active: boolean }>(
      'SELECT name, system_admin, active FROM user_groups WHERE id=$1',
      [groupId],
    );
    const current = existing.rows[0];
    if (!current) {
      return res.status(404).json({ success: false, message: 'User group was not found', code: 'GROUP_NOT_FOUND' });
    }
    if (input.name && input.name !== current.name) {
      const taken = await db.query<{ id: string }>(
        'SELECT id FROM user_groups WHERE upper(name)=upper($1) AND id<>$2',
        [input.name, groupId],
      );
      if (taken.rows[0]) {
        return res.status(409).json({
          success: false,
          message: 'A user group with this name already exists',
          code: 'GROUP_NAME_TAKEN',
        });
      }
    }
    const nextName = input.name ?? current.name;
    const nextSystemAdmin = input.systemAdmin ?? current.system_admin;
    const nextActive = input.active ?? current.active;
    const result = await db.query<GroupRow>(
      `UPDATE user_groups
       SET name=$2, system_admin=$3, active=$4
       WHERE id=$1
       RETURNING id,name,system_admin,active,ARRAY[]::uuid[] members`,
      [groupId, nextName, nextSystemAdmin, nextActive],
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'User group was not found', code: 'GROUP_NOT_FOUND' });
    }
    const members = await db.query<{ members: string[] }>(
      `SELECT COALESCE(array_agg(user_id) FILTER (WHERE user_id IS NOT NULL), ARRAY[]::uuid[]) members
       FROM user_group_members WHERE group_id=$1`,
      [groupId],
    );
    return res.json({
      success: true,
      data: publicGroup({ ...row, members: members.rows[0]?.members ?? [] }),
    });
  });
  router.delete('/user-groups/:groupId', requireAnyRole('ADMIN'), async (req, res) => {
    const { groupId } = userGroupIdParamSchema.parse(req.params);
    const existing = await db.query<{ name: string }>('SELECT name FROM user_groups WHERE id=$1', [groupId]);
    const current = existing.rows[0];
    if (!current) {
      return res.status(404).json({ success: false, message: 'User group was not found', code: 'GROUP_NOT_FOUND' });
    }
    if (isReservedGroupName(current.name)) {
      return res.status(409).json({
        success: false,
        message: 'System role groups cannot be deleted',
        code: 'SYSTEM_GROUP_PROTECTED',
      });
    }
    const members = await db.query<{ count: string }>(
      'SELECT count(*) count FROM user_group_members WHERE group_id=$1',
      [groupId],
    );
    if (Number(members.rows[0]?.count ?? 0) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete a user group that has assigned users',
        code: 'GROUP_HAS_MEMBERS',
      });
    }
    await db.query('DELETE FROM user_groups WHERE id=$1', [groupId]);
    return res.status(204).send();
  });
  router.post('/user-groups/:groupId/users/:userId', requireAnyRole('ADMIN'), async (req, res) => {
    const input = groupMembershipSchema.parse(req.params);
    await db.query(
      'INSERT INTO user_group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [input.groupId, input.userId],
    );
    res.status(204).send();
  });
  router.delete('/user-groups/:groupId/users/:userId', requireAnyRole('ADMIN'), async (req, res) => {
    const input = groupMembershipSchema.parse(req.params);
    const removed = await db.transaction(async (client) => {
      const group = await client.query<{ name: string }>(
        'SELECT name FROM user_groups WHERE id=$1 FOR UPDATE',
        [input.groupId],
      );
      if (!group.rows[0]) return 'missing';
      const existing = await client.query(
        'SELECT 1 FROM user_group_members WHERE group_id=$1 AND user_id=$2',
        [input.groupId, input.userId],
      );
      if (!existing.rowCount) return 'missing';
      if (group.rows[0].name === 'ADMIN') {
        const count = await client.query<{ count: string }>(
          'SELECT count(*) count FROM user_group_members WHERE group_id=$1',
          [input.groupId],
        );
        if (Number(count.rows[0]?.count ?? 0) <= 1) return 'last-admin';
      }
      await client.query(
        'DELETE FROM user_group_members WHERE group_id=$1 AND user_id=$2',
        [input.groupId, input.userId],
      );
      return 'removed';
    });
    if (removed === 'last-admin') {
      return res.status(409).json({
        success: false,
        message: 'At least one administrator must remain',
        code: 'LAST_ADMIN_REQUIRED',
      });
    }
    if (removed === 'missing') {
      return res.status(404).json({
        success: false,
        message: 'Group membership was not found',
        code: 'MEMBERSHIP_NOT_FOUND',
      });
    }
    return res.status(204).send();
  });
  return router;
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    roles: row.roles,
    active: row.active,
    groupId: row.group_id,
    groupName: row.group_name,
    createdAt: row.created_at.toISOString(),
  };
}

function publicGroup(row: GroupRow) {
  return {
    id: row.id,
    name: row.name,
    systemAdmin: row.system_admin,
    active: row.active,
    members: row.members ?? [],
  };
}
