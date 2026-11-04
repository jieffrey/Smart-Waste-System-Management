const { createRateLimiter } = require('./rate-limit');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Login, per IP: 20 attempts per 15 minutes. Enough for a person who mistypes a few times (or a
// household/office sharing one IP), far too few for password guessing: at most ~1,900 guesses a day
// per IP instead of thousands per minute.
const loginIpLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  key: (req) => `login-ip:${req.ip}`,
  action: 'login attempts',
});

// Login, per email: 5 failed attempts per 15 minutes, whatever IP they come from. Stops guessing one
// account from many IPs. Only failures count, so a user who signs in successfully is never blocked.
// The key is the email as typed (normalized), whether or not an account exists, so being limited
// reveals nothing about which emails are registered.
// Trade-off: someone can lock a known email out for 15 minutes by failing on purpose. A short window
// keeps that nuisance small, and the per-IP limit caps how often they can repeat it.
const loginEmailLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: 5,
  key: (req) => `login-email:${req.body.email}`,
  action: 'login attempts',
  onlyFailures: true,
});

// Registration, per IP: 10 accounts per hour. A family or class registering together fits; mass
// account creation (to get around the per-account upload limit) doesn't.
const registerLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: 10,
  key: (req) => `register-ip:${req.ip}`,
  action: 'sign-up attempts',
});

// New reports, per user: 20 per hour. Someone reporting a whole street of waste fits; a script filling
// the disk with 5 MB photos (and the ML API with work) doesn't: at most ~100 MB per user per hour.
// Counted per account (not IP), because many phones can share one mobile-network IP.
const reportLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: 20,
  key: (req) => `report-user:${req.user.id}`,
  action: 'new reports',
});

module.exports = { loginIpLimiter, loginEmailLimiter, registerLimiter, reportLimiter };
