const app = require('./app');
const { env } = require('./config/env');
const { connectPool, closePool } = require('./config/db');
const logger = require('./logger/logger');

let server;

const startServer = async () => {
  try {
    await connectPool();
  } catch (error) {
    if (env.DB.required) {
      logger.error('Failed to start server', { message: error.message });
      process.exit(1);
    }

    logger.warn('Server starting without database connection', {
      message: error.message,
      hint: 'Set DB_REQUIRED=false to allow this, or fix DB settings in .env',
    });
  }

  server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
};

const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      try {
        await closePool();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { message: error.message });
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
