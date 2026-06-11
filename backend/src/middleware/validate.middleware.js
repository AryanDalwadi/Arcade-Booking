const response = require('../helper/response.helper');
const logger = require('../logger/logger');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.error('Validation failed', {
        statusCode: 400,
        path: req.originalUrl,
        method: req.method,
        errors,
      });

      return response.error(res, 'Validation failed', 400, errors);
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
