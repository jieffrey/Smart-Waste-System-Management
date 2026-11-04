// Mounted at /api/auth (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');
const { loginIpLimiter, loginEmailLimiter, registerLimiter } = require('../../middlewares/limiters');
const { registerSchema, loginSchema } = require('./auth.schema');
const authController = require('./auth.controller');

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
// The per-email limiter runs after validation, so it counts the normalized email.
router.post('/login', loginIpLimiter, validate(loginSchema), loginEmailLimiter, authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
