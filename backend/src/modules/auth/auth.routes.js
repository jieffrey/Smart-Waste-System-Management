// Mounted at /api/auth (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');
const { registerSchema, loginSchema } = require('./auth.schema');
const authController = require('./auth.controller');

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
