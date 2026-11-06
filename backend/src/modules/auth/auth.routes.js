// Mounted at /api/auth (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');
const {
  loginIpLimiter,
  loginEmailLimiter,
  registerLimiter,
  profileLimiter,
  passwordChangeLimiter,
  verifyCodeLimiter,
  resendCodeLimiter,
} = require('../../middlewares/limiters');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendCodeSchema,
} = require('./auth.schema');
const authController = require('./auth.controller');

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
// The per-email limiter runs after validation, so it counts the normalized email.
router.post('/login', loginIpLimiter, validate(loginSchema), loginEmailLimiter, authController.login);
// Email verification (only when OTP_ENABLED=true; otherwise 404)
router.post('/verify-email', verifyCodeLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-code', resendCodeLimiter, validate(resendCodeSchema), authController.resendCode);
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, profileLimiter, validate(updateProfileSchema), authController.updateMe);
router.post(
  '/change-password',
  authenticate,
  passwordChangeLimiter,
  validate(changePasswordSchema),
  authController.changePassword
);

module.exports = router;
