const { env } = require('./env');
const logger = require('../logger/logger');

const sql = env.DB.useWindowsAuth
  ? require('mssql/msnodesqlv8')
  : require('mssql');

let pool = null;

const buildServerName = () => {
  if (env.DB.instanceName) {
    return `${env.DB.server}\\${env.DB.instanceName}`;
  }
  return env.DB.server;
};

const buildDbConfig = () => {
  if (env.DB.useWindowsAuth) {
    const server = buildServerName();
    const trustCert = env.DB.trustServerCertificate ? 'yes' : 'no';
    const encrypt = env.DB.encrypt ? 'yes' : 'no';

    return {
      connectionString: `Driver={${env.DB.odbcDriver}};Server=${server};Database=${env.DB.database};Trusted_Connection=yes;TrustServerCertificate=${trustCert};Encrypt=${encrypt};`,
      connectionTimeout: 15000,
      options: {
        trustedConnection: true,
        trustServerCertificate: env.DB.trustServerCertificate,
        encrypt: env.DB.encrypt,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
  }

  const config = {
    server: env.DB.server,
    database: env.DB.database,
    user: env.DB.user,
    password: env.DB.password,
    options: {
      encrypt: env.DB.encrypt,
      trustServerCertificate: env.DB.trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: 15000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (env.DB.port) {
    config.port = env.DB.port;
  }

  if (env.DB.instanceName) {
    config.options.instanceName = env.DB.instanceName;
  }

  return config;
};

const connectPool = async () => {
  if (pool) {
    return pool;
  }

  const dbConfig = buildDbConfig();

  try {
    pool = await sql.connect(dbConfig);
    logger.info('MSSQL connection pool established', {
      database: env.DB.database,
      server: env.DB.server,
      auth: env.DB.useWindowsAuth ? 'windows' : 'sql',
    });
    return pool;
  } catch (error) {
    logger.error('Failed to connect to MSSQL', {
      message: error.message,
      server: env.DB.server,
      auth: env.DB.useWindowsAuth ? 'windows' : 'sql',
    });
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database is not connected. Check MSSQL settings in .env and error.log.');
  }
  return pool;
};

const isConnected = () => Boolean(pool);

const closePool = async () => {
  if (!pool) {
    return;
  }

  try {
    await pool.close();
    pool = null;
    logger.info('MSSQL connection pool closed');
  } catch (error) {
    logger.error('Error closing MSSQL pool', { message: error.message });
    throw error;
  }
};

module.exports = {
  sql,
  connectPool,
  getPool,
  isConnected,
  closePool,
};
