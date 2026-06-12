const { getPool, sql } = require('../config/db');

const findByEmail = async (email) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar(255), email)
    .execute('dbo.Get_User_By_Email');

  return result.recordset[0] || null;
};

const findByLogin = async (login) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('login', sql.NVarChar(255), login)
    .execute('dbo.Get_User_By_Login');

  return result.recordset[0] || null;
};

const createUser = async ({ name, email, passwordHash, createdBy = null }) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), name)
    .input('email', sql.NVarChar(255), email)
    .input('password_hash', sql.NVarChar(255), passwordHash)
    .input('created_by', sql.Int, createdBy)
    .execute('dbo.Create_User');

  return result.recordset[0];
};

const getUsers = async ({ name = '', email = '', pageSize = 20, currentPage = 1 }) => {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), name)
    .input('email', sql.NVarChar(255), email)
    .input('page_size', sql.Int, pageSize)
    .input('current_page', sql.Int, currentPage)
    .execute('dbo.Get_User');

  return {
    summary: result.recordsets[0][0] || null,
    data: result.recordsets[1] || [],
  };
};

const updateUser = async ({ id, name, email, passwordHash, updatedBy = null }) => {
  const pool = getPool();
  const request = pool.request().input('id', sql.Int, id);

  if (name !== undefined) {
    request.input('name', sql.NVarChar(100), name);
  }
  if (email !== undefined) {
    request.input('email', sql.NVarChar(255), email);
  }
  if (passwordHash !== undefined) {
    request.input('password_hash', sql.NVarChar(255), passwordHash);
  }
  request.input('updated_by', sql.Int, updatedBy);

  const result = await request.execute('dbo.Update_User');
  return result.recordset[0] || null;
};

module.exports = {
  findByEmail,
  findByLogin,
  createUser,
  getUsers,
  updateUser,
};
