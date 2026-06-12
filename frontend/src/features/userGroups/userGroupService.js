import api from '../../api/axios';

/**
 * @param {import('./userGroup.types').GetUserGroupsRequest} payload
 * @returns {Promise<import('./userGroup.types').GetUserGroupsResponse>}
 */
export const getUserGroups = async (payload) => {
  const response = await api.post('/user-groups/get', payload);
  return response.data;
};

/**
 * @param {import('./userGroup.types').CreateUserGroupRequest} payload
 */
export const createUserGroup = async (payload) => {
  const response = await api.post('/user-groups/create', payload);
  return response.data;
};

/**
 * @param {import('./userGroup.types').UpdateUserGroupRequest} payload
 */
export const updateUserGroup = async (payload) => {
  const response = await api.post('/user-groups/update', payload);
  return response.data;
};
