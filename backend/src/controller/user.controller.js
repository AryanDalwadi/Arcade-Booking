const userService = require('../service/user.service');
const response = require('../helper/response.helper');

const getUsers = async (req, res, next) => {
  try {
    const result = await userService.getUsers(req.body);
    return response.paginatedList(res, {
      message: '',
      summary: result.summary,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id, ...payload } = req.body;
    const updatedBy = req.user?.id ? parseInt(req.user.id, 10) : null;
    const user = await userService.updateUser(
      parseInt(id, 10),
      payload,
      updatedBy
    );
    return response.success(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  updateUser,
};
