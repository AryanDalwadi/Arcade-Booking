import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Router } from 'express';
import {
  createUserGroupSchema,
  groupMembershipSchema,
  loginSchema,
  registerUserSchema,
  userRoleSchema,
} from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import { Env } from '../config/env';

type UserRow = { id: string; email: string; display_name: string; password_hash: string; roles: string[]; created_at: Date };
const roleFilter = "ug.name IN ('CUSTOMER','STAFF','ADMIN')";

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
  router.post('/auth/register', async (req, res) => {
    const input = registerUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await db.query<UserRow>(
      `WITH new_user AS (
         INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3)
         ON CONFLICT(email) DO NOTHING
         RETURNING id,email,display_name,password_hash,created_at
       ), membership AS (
         INSERT INTO user_group_members(group_id,user_id)
         SELECT ug.id,nu.id FROM user_groups ug CROSS JOIN new_user nu
         WHERE ug.name='CUSTOMER'
       )
       SELECT id,email,display_name,password_hash,ARRAY['CUSTOMER']::text[] roles,created_at
       FROM new_user`,
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
      `SELECT u.id,u.email,u.display_name,u.password_hash,u.created_at,
       COALESCE(array_agg(ug.name) FILTER (WHERE ${roleFilter}), ARRAY['CUSTOMER']::text[]) roles
       FROM users u LEFT JOIN user_group_members m ON m.user_id=u.id
       LEFT JOIN user_groups ug ON ug.id=m.group_id WHERE u.email=$1 GROUP BY u.id`,
      [input.email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
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
      `SELECT u.id,u.email,u.display_name,u.password_hash,u.created_at,
       COALESCE(array_agg(ug.name) FILTER (WHERE ${roleFilter}), ARRAY['CUSTOMER']::text[]) roles
       FROM users u
       LEFT JOIN user_group_members m ON m.user_id=u.id
       LEFT JOIN user_groups ug ON ug.id=m.group_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
    );
    res.json({ success: true, data: result.rows.map(publicUser) });
  });
  router.get('/user-groups', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const result = await db.query<{id:string;name:string;members:string[]}>(
      `SELECT ug.id,ug.name,
       COALESCE(array_agg(m.user_id) FILTER (WHERE m.user_id IS NOT NULL), ARRAY[]::uuid[]) members
       FROM user_groups ug
       LEFT JOIN user_group_members m ON m.group_id=ug.id
       GROUP BY ug.id
       ORDER BY ug.name`,
    );
    res.json({ success: true, data: result.rows });
  });
  router.post('/user-groups', requireAnyRole('ADMIN'), async (req, res) => {
    const { name } = createUserGroupSchema.parse(req.body);
    if (userRoleSchema.safeParse(name.toUpperCase()).success) {
      return res.status(409).json({
        success: false,
        message: 'System role groups already exist and cannot be recreated',
        code: 'SYSTEM_GROUP_RESERVED',
      });
    }
    const result = await db.query<{id:string;name:string}>('INSERT INTO user_groups(name) VALUES($1) RETURNING id,name', [name]);
    return res.status(201).json({ success: true, data: result.rows[0] });
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
  return { id: row.id, email: row.email, displayName: row.display_name, roles: row.roles, createdAt: row.created_at.toISOString() };
}

