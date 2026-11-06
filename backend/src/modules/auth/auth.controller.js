const authService = require('./auth.service');

async function register(req, res) {
  // { user, token }, or { user, verification_required: true } when OTP is on
  const result = await authService.registerUser(req.body);
  res.status(201).json(result);
}

async function verifyEmail(req, res) {
  const { user, token } = await authService.verifyEmail(req.body);
  res.status(200).json({ user, token });
}

async function resendCode(req, res) {
  try {
    await authService.resendCode(req.body);
  } catch (err) {
    if (err.retryAfterSeconds) {
      res.set('Retry-After', String(err.retryAfterSeconds));
    }
    throw err;
  }
  res.status(200).json({ message: 'If this account still needs verification, a new code has been sent' });
}

async function login(req, res) {
  const { user, token } = await authService.loginUser(req.body);
  res.status(200).json({ user, token });
}

function me(req, res) {
  res.status(200).json({ user: req.user });
}

async function updateMe(req, res) {
  const user = await authService.updateProfile(req.user.id, req.body);
  res.status(200).json({ user });
}

async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.body);
  res.status(200).json({ message: 'Password changed' });
}

module.exports = { register, login, me, updateMe, changePassword, verifyEmail, resendCode };
