import bcrypt from 'bcryptjs';
import pg from 'pg';

const cfg = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  user: process.env.DB_USER ?? 'identity_app',
  password: process.env.DB_PASSWORD ?? 'identity_local',
  database: process.env.DB_NAME ?? 'identity',
};

const client = new pg.Client(cfg);
await client.connect();

await client.query('BEGIN');
await client.query('DELETE FROM users');
const groups = await client.query(
  "SELECT id, name FROM user_groups WHERE name IN ('CUSTOMER', 'ADMIN')",
);

async function createUser(email, displayName, password, roleName) {
  const hash = await bcrypt.hash(password, 12);
  const inserted = await client.query(
    'INSERT INTO users(email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email',
    [email.toLowerCase(), displayName, hash],
  );
  const group = groups.rows.find((g) => g.name === roleName);
  if (!group) throw new Error(`Missing group ${roleName}`);
  await client.query('INSERT INTO user_group_members(group_id, user_id) VALUES ($1, $2)', [
    group.id,
    inserted.rows[0].id,
  ]);
  return { email: inserted.rows[0].email, role: roleName };
}

const created = [];
created.push(await createUser('aryan@test.com', 'Aryan', 'Aryan@123', 'ADMIN'));
created.push(await createUser('customer@gmail.com', 'Customer', 'Customer@123', 'CUSTOMER'));
await client.query('COMMIT');

const verify = await client.query(`
  SELECT u.email, u.display_name,
    COALESCE(array_agg(ug.name ORDER BY ug.name) FILTER (WHERE ug.name IS NOT NULL), ARRAY[]::text[]) AS roles
  FROM users u
  LEFT JOIN user_group_members m ON m.user_id = u.id
  LEFT JOIN user_groups ug ON ug.id = m.group_id
  GROUP BY u.id, u.email, u.display_name
  ORDER BY u.email`);

console.log(JSON.stringify({ created, users: verify.rows, count: verify.rows.length }, null, 2));
await client.end();
