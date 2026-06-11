const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

const ERROR_LOG_PATH = path.join(__dirname, '../../error.log');

const formatMessage = (level, message, meta) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    env: env.NODE_ENV,
    message,
  };

  if (meta) {
    entry.meta = meta;
  }

  return JSON.stringify(entry);
};

const writeToErrorLog = (formattedMessage) => {
  try {
    fs.appendFileSync(ERROR_LOG_PATH, `${formattedMessage}\n`, 'utf8');
  } catch (writeError) {
    console.error('Failed to write to error.log', writeError.message);
  }
};

const logger = {
  info(message, meta) {
    console.log(formatMessage('info', message, meta));
  },
  warn(message, meta) {
    const formatted = formatMessage('warn', message, meta);
    console.warn(formatted);
    writeToErrorLog(formatted);
  },
  error(message, meta) {
    const formatted = formatMessage('error', message, meta);
    console.error(formatted);
    writeToErrorLog(formatted);
  },
};

module.exports = logger;
