const { verifyToken } = require('../utils/jwt.util');
const response = require('../helper/response.helper');
const logger = require('../logger/logger');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('Access token is required', {
      statusCode: 401,
      path: req.originalUrl,
      method: req.method,
    });
    return response.error(res, 'Access token is required', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Invalid or expired token', {
      statusCode: 401,
      path: req.originalUrl,
      method: req.method,
    });
    return response.error(res, 'Invalid or expired token', 401);
  }
};

module.exports = authenticate;
