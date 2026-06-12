const Joi = require('joi');

const getUserGroupsSchema = Joi.object({
  group_name: Joi.string().trim().max(100).allow('').default(''),
  status: Joi.number().integer().valid(0, 1, 2).default(0),
  page_size: Joi.number().integer().min(1).max(100).default(20),
  current_page: Joi.number().integer().min(1).default(1),
});

const createUserGroupSchema = Joi.object({
  group_name: Joi.string().trim().min(1).max(100).required(),
  sys_admin: Joi.boolean().required(),
  status: Joi.number().integer().valid(1, 2).required(),
});

const updateUserGroupSchema = Joi.object({
  id: Joi.string().uuid().required(),
  group_name: Joi.string().trim().min(1).max(100),
  sys_admin: Joi.boolean(),
  status: Joi.number().integer().valid(1, 2),
}).or('group_name', 'sys_admin', 'status');

module.exports = {
  getUserGroupsSchema,
  createUserGroupSchema,
  updateUserGroupSchema,
};
