const { env } = require('./env');
const logger = require('../logger/logger');
const { Pool } = require('pg');

let pool = null;
let connected = false;

const buildDbConfig = () => {
  return {
    host: env.DB.host,
    port: env.DB.port,
    database: env.DB.database,
    user: env.DB.user,
    password: env.DB.password,
    ssl: env.DB.ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  };
};

const connectPool = async () => {
  if (pool && connected) {
    return pool;
  }

  pool = new Pool(buildDbConfig());
  pool.on('error', (error) => {
    connected = false;
    logger.error('Unexpected PostgreSQL pool error', { message: error.message });
  });

  try {
    await pool.query('SELECT 1');
    connected = true;
    logger.info('PostgreSQL connection pool established', {
      database: env.DB.database,
      host: env.DB.host,
      port: env.DB.port,
    });
    return pool;
  } catch (error) {
    await pool.end().catch(() => {});
    pool = null;
    connected = false;
    logger.error('Failed to connect to PostgreSQL', {
      message: error.message,
      host: env.DB.host,
      port: env.DB.port,
    });
    throw error;
  }
};

const getPool = () => {
  if (!pool || !connected) {
    throw new Error('Database is not connected. Check PostgreSQL settings in .env and error.log.');
  }
  return pool;
};

const isConnected = () => Boolean(pool && connected);

const closePool = async () => {
  if (!pool) {
    return;
  }

  try {
    await pool.end();
    pool = null;
    connected = false;
    logger.info('PostgreSQL connection pool closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL pool', { message: error.message });
    throw error;
  }
};

module.exports = {
  connectPool,
  getPool,
  isConnected,
  closePool,
};
