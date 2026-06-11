const { env } = require('../config/env');
const logger = require('../logger/logger');
const response = require('../helper/response.helper');

class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

const notFoundHandler = (req, res) => {
  logger.error('Route not found', {
    statusCode: 404,
    path: req.originalUrl,
    method: req.method,
  });

  return response.error(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error(message, {
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const body = {
    success: false,
    message,
  };

  if (err.errors) {
    body.errors = err.errors;
  }

  if (env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
