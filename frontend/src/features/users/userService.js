import api from '../../api/axios';

/**
 * @param {import('./user.types').GetUsersRequest} payload
 * @returns {Promise<import('./user.types').GetUsersResponse>}
 */
export const getUsers = async (payload) => {
  const response = await api.post('/users/get', payload);
  return response.data;
};

/**
 * @param {import('./user.types').CreateUserRequest} payload
 */
export const createUser = async (payload) => {
  const response = await api.post('/auth/register', payload);
  return response.data;
};

/**
 * @param {import('./user.types').UpdateUserRequest} payload
 */
export const updateUser = async (payload) => {
  const response = await api.post('/users/update', payload);
  return response.data;
};
