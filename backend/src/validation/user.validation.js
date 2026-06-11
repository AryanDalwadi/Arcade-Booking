const Joi = require('joi');

const getUsersSchema = Joi.object({
  name: Joi.string().trim().max(100).allow('').default(''),
  email: Joi.string().trim().max(255).allow('').default(''),
  page_size: Joi.number().integer().min(1).max(100).default(20),
  current_page: Joi.number().integer().min(1).default(1),
});

const updateUserSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().trim().email(),
  password: Joi.string().min(6).max(128),
}).or('name', 'email', 'password');

module.exports = {
  getUsersSchema,
  updateUserSchema,
};
