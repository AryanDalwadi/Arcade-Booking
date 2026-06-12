import api from '../api/axios';

export const login = async ({ login, password }) => {
  const response = await api.post('/auth/login', { login, password });
  return response.data;
};
