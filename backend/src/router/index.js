const express = require('express');
const healthRouter = require('./health.router');
const authRouter = require('./auth.router');
const userRouter = require('./user.router');
const userGroupRouter = require('./userGroup.router');
const response = require('../helper/response.helper');

const router = express.Router();

router.get('/', (req, res) => {
  return response.success(res, {
    name: 'Arcade Booking API',
    basePath: '/api',
    endpoints: [
      'POST /api/health',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/users/get',
      'POST /api/users/update',
      'POST /api/user-groups/get',
      'POST /api/user-groups/create',
      'POST /api/user-groups/update',
    ],
  });
});

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/user-groups', userGroupRouter);

module.exports = router;
