const authService = require('./auth.service');

async function register(req, res) {
  const { user, token } = await authService.registerUser(req.body);
  res.status(201).json({ user, token });
}

async function login(req, res) {
  const { user, token } = await authService.loginUser(req.body);
  res.status(200).json({ user, token });
}

function me(req, res) {
  res.status(200).json({ user: req.user });
}

module.exports = { register, login, me };
