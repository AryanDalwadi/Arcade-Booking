const { getPool, sql } = require('../config/db');

const findByGroupName = async (groupName) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('group_name', sql.NVarChar(100), groupName)
    .query(`
      SELECT id, group_name
      FROM dbo.user_groups
      WHERE LOWER(group_name) = LOWER(@group_name)
    `);

  return result.recordset[0] || null;
};

const createUserGroup = async ({ groupName, sysAdmin, status, createdBy = null }) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('group_name', sql.NVarChar(100), groupName)
    .input('sys_admin', sql.Bit, sysAdmin)
    .input('status', sql.Int, status)
    .input('created_by', sql.Int, createdBy)
    .execute('dbo.Create_User_Group');

  return result.recordset[0];
};

const getUserGroups = async ({
  groupName = '',
  status = 0,
  pageSize = 20,
  currentPage = 1,
}) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('group_name', sql.NVarChar(100), groupName)
    .input('status', sql.Int, status)
    .input('page_size', sql.Int, pageSize)
    .input('current_page', sql.Int, currentPage)
    .execute('dbo.Get_User_Group');

  return {
    summary: result.recordsets[0][0] || null,
    data: result.recordsets[1] || [],
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
  const request = pool.request().input('id', sql.UniqueIdentifier, id);

  if (groupName !== undefined) {
    request.input('group_name', sql.NVarChar(100), groupName);
  }
  if (sysAdmin !== undefined) {
    request.input('sys_admin', sql.Bit, sysAdmin);
  }
  if (status !== undefined) {
    request.input('status', sql.Bit, status);
  }
  request.input('updated_by', sql.Int, updatedBy);

  const result = await request.execute('dbo.Update_User_Group');
  return result.recordset[0] || null;
};

module.exports = {
  findByGroupName,
  createUserGroup,
  getUserGroups,
  updateUserGroup,
};
