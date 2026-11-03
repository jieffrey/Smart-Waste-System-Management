// Mounted at /api/admin/users (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate, authorizeRole } = require('../../middlewares/auth');
const { listUsersSchema, updateUserSchema } = require('./users.schema');
const usersController = require('./users.controller');

const router = Router();

// Every route in this file is for admins only.
router.use(authenticate, authorizeRole('admin'));

router.get('/', validate(listUsersSchema, 'query'), usersController.listUsers);
router.patch('/:id', validate(updateUserSchema), usersController.updateUser);

module.exports = router;
