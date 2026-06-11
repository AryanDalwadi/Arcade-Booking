const express = require('express');
const healthRouter = require('./health.router');
const authRouter = require('./auth.router');
const userRouter = require('./user.router');

const router = express.Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);

module.exports = router;
