const express = require('express');
const response = require('../helper/response.helper');
const { isConnected } = require('../config/db');

const router = express.Router();

router.post('/', (req, res) => {
  return response.success(res, {
    status: 'ok',
    database: isConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
