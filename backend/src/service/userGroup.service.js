const userGroupDa = require('../data_access/userGroup.da');
const { AppError } = require('../middleware/error.middleware');

const getUserGroups = async (filters) =>
  userGroupDa.getUserGroups({
    groupName: filters.group_name || '',
    status: filters.status ?? 0,
    pageSize: filters.page_size,
    currentPage: filters.current_page,
  });

const createUserGroup = async (payload, createdBy = null) => {
  const existingGroup = await userGroupDa.findByGroupName(payload.group_name);

  if (existingGroup) {
    throw new AppError('Group name is already in use', 409);
  }

  return userGroupDa.createUserGroup({
    groupName: payload.group_name,
    sysAdmin: payload.sys_admin ? 1 : 0,
    status: payload.status,
    createdBy,
  });
};

const updateUserGroup = async (id, payload, updatedBy = null) => {
  if (payload.group_name) {
    const existingGroup = await userGroupDa.findByGroupName(payload.group_name);

    if (existingGroup && String(existingGroup.id).toLowerCase() !== String(id).toLowerCase()) {
      throw new AppError('Group name is already in use', 409);
    }
  }

  const updatePayload = { id, updatedBy };

  if (payload.group_name !== undefined) {
    updatePayload.groupName = payload.group_name;
  }
  if (payload.sys_admin !== undefined) {
    updatePayload.sysAdmin = payload.sys_admin ? 1 : 0;
  }
  if (payload.status !== undefined) {
    updatePayload.status = payload.status;
  }

  try {
    const group = await userGroupDa.updateUserGroup(updatePayload);

    if (!group) {
      throw new AppError('User group not found', 404);
    }

    return group;
  } catch (error) {
    if (error.message && error.message.includes('User group not found')) {
      throw new AppError('User group not found', 404);
    }
    throw error;
  }
};

module.exports = {
  getUserGroups,
  createUserGroup,
  updateUserGroup,
};
