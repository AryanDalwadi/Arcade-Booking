const authService = require('../service/auth.service');
const response = require('../helper/response.helper');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return response.success(res, result, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return response.success(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
};
