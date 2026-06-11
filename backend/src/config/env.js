require('dotenv').config();

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    server: process.env.DB_SERVER || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    instanceName: process.env.DB_INSTANCE || undefined,
    database: process.env.DB_NAME || 'arcade_booking',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    useWindowsAuth: process.env.DB_USE_WINDOWS_AUTH === 'true',
    odbcDriver: process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server',
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    required: process.env.DB_REQUIRED !== 'false',
  },
  JWT: {
    secret: process.env.JWT_SECRET || 'change_me_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};

module.exports = { env };
