const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const signToken = (payload) => {
  return jwt.sign(payload, env.JWT.secret, {
    expiresIn: env.JWT.expiresIn,
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.JWT.secret);
};

module.exports = { signToken, verifyToken };
