const express = require('express');
const userController = require('../controller/user.controller');
const validate = require('../middleware/validate.middleware');
const authenticate = require('../middleware/auth.middleware');
const { getUsersSchema, updateUserSchema } = require('../validation/user.validation');

const router = express.Router();

router.post('/get', authenticate, validate(getUsersSchema), userController.getUsers);
router.post('/update', authenticate, validate(updateUserSchema), userController.updateUser);

module.exports = router;
