const { getPool } = require('../config/db');

const findByGroupName = async (groupName) => {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, group_name
     FROM dbo.user_groups
     WHERE LOWER(group_name) = LOWER($1)`,
    [groupName]
  );

  return result.rows[0] || null;
};

const createUserGroup = async ({ groupName, sysAdmin, status, createdBy = null }) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM dbo.create_user_group($1, $2, $3, $4)',
    [groupName, Boolean(sysAdmin), status, createdBy]
  );

  return result.rows[0];
};

const getUserGroups = async ({
  groupName = '',
  status = 0,
  pageSize = 20,
  currentPage = 1,
}) => {
  const pool = getPool();
  const normalizedPageSize = Math.max(Number(pageSize) || 20, 1);
  const normalizedCurrentPage = Math.max(Number(currentPage) || 1, 1);

  const [countResult, dataResult] = await Promise.all([
    pool.query(
      `SELECT count(1)::INTEGER AS total_count
       FROM dbo.user_groups
       WHERE ($1 = '' OR group_name ILIKE '%' || $1 || '%')
         AND ($2::INTEGER = 0 OR status = $2::INTEGER)`,
      [groupName, status]
    ),
    pool.query(
      `SELECT sr_no, id, group_name, sys_admin, status, insert_by,
              insert_by_val, insert_datetime, update_by, update_by_val,
              update_datetime
       FROM dbo.get_user_group($1, $2, $3, $4)`,
      [groupName, status, normalizedPageSize, normalizedCurrentPage]
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

const updateUserGroup = async ({
  id,
  groupName,
  sysAdmin,
  status,
  updatedBy = null,
}) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM dbo.update_user_group($1, $2, $3, $4, $5)',
    [
      id,
      groupName ?? null,
      sysAdmin === undefined ? null : Boolean(sysAdmin),
      status ?? null,
      updatedBy,
    ]
  );

  return result.rows[0] || null;
};

module.exports = {
  findByGroupName,
  createUserGroup,
  getUserGroups,
  updateUserGroup,
};
