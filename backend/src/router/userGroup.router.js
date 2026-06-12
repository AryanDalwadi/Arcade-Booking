const express = require('express');
const userGroupController = require('../controller/userGroup.controller');
const validate = require('../middleware/validate.middleware');
const authenticate = require('../middleware/auth.middleware');
const {
  getUserGroupsSchema,
  createUserGroupSchema,
  updateUserGroupSchema,
} = require('../validation/userGroup.validation');

const router = express.Router();

router.post('/get', authenticate, validate(getUserGroupsSchema), userGroupController.getUserGroups);
router.post(
  '/create',
  authenticate,
  validate(createUserGroupSchema),
  userGroupController.createUserGroup
);
router.post(
  '/update',
  authenticate,
  validate(updateUserGroupSchema),
  userGroupController.updateUserGroup
);

module.exports = router;
