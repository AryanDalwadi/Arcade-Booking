const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const router = require('./router');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
