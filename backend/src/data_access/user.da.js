const { getPool } = require('../config/db');

const findByEmail = async (email) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM dbo.get_user_by_email($1)',
    [email ?? null]
  );

  return result.rows[0] || null;
};

const findByLogin = async (login) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM dbo.get_user_by_login($1)',
    [login]
  );

  return result.rows[0] || null;
};

const createUser = async ({ name, email, passwordHash, createdBy = null }) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM dbo.create_user($1, $2, $3, $4)',
    [name, email, passwordHash, createdBy]
  );

  return result.rows[0];
};

const getUsers = async ({ name = '', email = '', pageSize = 20, currentPage = 1 }) => {
  const pool = getPool();
  const normalizedPageSize = Math.max(Number(pageSize) || 20, 1);
  const normalizedCurrentPage = Math.max(Number(currentPage) || 1, 1);

  const [countResult, dataResult] = await Promise.all([
    pool.query(
      `SELECT count(1)::INTEGER AS total_count
       FROM dbo.users
       WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
         AND ($2 = '' OR email ILIKE '%' || $2 || '%')`,
      [name, email]
    ),
    pool.query(
      `SELECT sr_no, id, name, email, insert_by, insert_by_val,
              insert_datetime, update_by, update_by_val, update_datetime
       FROM dbo.get_user($1, $2, $3, $4)`,
      [name, email, normalizedPageSize, normalizedCurrentPage]
    ),
  ]);

  const totalCount = countResult.rows[0]?.total_count || 0;
  const totalPage = Math.ceil(totalCount / normalizedPageSize);

  return {
    summary: {
      success: 1,
      current_page: normalizedCurrentPage,
      total_count: totalCount,
      has_more: normalizedCurrentPage < totalPage,
      page_size: normalizedPageSize,
      total_page: totalPage,
    },
    data: dataResult.rows,
  };
};

const updateUser = async ({ id, name, email, passwordHash, updatedBy = null }) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM dbo.update_user($1, $2, $3, $4, $5)',
    [id, name ?? null, email ?? null, passwordHash ?? null, updatedBy]
  );

  return result.rows[0] || null;
};

module.exports = {
  findByEmail,
  findByLogin,
  createUser,
  getUsers,
  updateUser,
};
