const userGroupService = require('../service/userGroup.service');
const response = require('../helper/response.helper');

const getUserGroups = async (req, res, next) => {
  try {
    const result = await userGroupService.getUserGroups(req.body);
    return response.paginatedList(res, {
      message: '',
      summary: result.summary,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

const createUserGroup = async (req, res, next) => {
  try {
    const createdBy = req.user?.id ? parseInt(req.user.id, 10) : null;
    const group = await userGroupService.createUserGroup(req.body, createdBy);
    return response.success(res, group, 'User group created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const updateUserGroup = async (req, res, next) => {
  try {
    const { id, ...payload } = req.body;
    const updatedBy = req.user?.id ? parseInt(req.user.id, 10) : null;
    const group = await userGroupService.updateUserGroup(id, payload, updatedBy);
    return response.success(res, group, 'User group updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserGroups,
  createUserGroup,
  updateUserGroup,
};
