const userDa = require('../data_access/user.da');
const { hashPassword } = require('../utils/bcrypt.util');
const { AppError } = require('../middleware/error.middleware');

const getUsers = async (filters) => {
  return userDa.getUsers({
    name: filters.name || '',
    email: filters.email || '',
    pageSize: filters.page_size,
    currentPage: filters.current_page,
  });
};

const updateUser = async (id, payload, updatedBy = null) => {
  const existingUser = await userDa.findByEmail(payload.email);

  if (payload.email && existingUser && String(existingUser.id) !== String(id)) {
    throw new AppError('Email is already registered', 409);
  }

  const updatePayload = {
    id,
    updatedBy,
  };

  if (payload.name !== undefined) {
    updatePayload.name = payload.name;
  }
  if (payload.email !== undefined) {
    updatePayload.email = payload.email;
  }
  if (payload.password !== undefined) {
    updatePayload.passwordHash = await hashPassword(payload.password);
  }

  try {
    const user = await userDa.updateUser(updatePayload);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  } catch (error) {
    if (error.message && error.message.includes('User not found')) {
      throw new AppError('User not found', 404);
    }
    throw error;
  }
};

module.exports = {
  getUsers,
  updateUser,
};
