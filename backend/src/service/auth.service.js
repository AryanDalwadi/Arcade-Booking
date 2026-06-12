const userDa = require('../data_access/user.da');
const { hashPassword, comparePassword } = require('../utils/bcrypt.util');
const { signToken } = require('../utils/jwt.util');
const { AppError } = require('../middleware/error.middleware');

const register = async ({ name, email, password }) => {
  const existingUser = await userDa.findByEmail(email);

  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await userDa.createUser({ name, email, passwordHash });

  const token = signToken({ id: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    },
    token,
  };
};

const login = async ({ login, password }) => {
  const user = await userDa.findByLogin(login);

  if (!user) {
    throw new AppError('Invalid username, email or password', 401);
  }

  const isMatch = await comparePassword(password, user.password_hash);

  if (!isMatch) {
    throw new AppError('Invalid username, email or password', 401);
  }

  const token = signToken({ id: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    },
    token,
  };
};

module.exports = {
  register,
  login,
};
