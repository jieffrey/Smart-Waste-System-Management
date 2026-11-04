const HttpError = require('../utils/http-error');

// Simple fixed-window rate limiting, kept in this process's memory.
//
// LIMITATION: the counters live in memory. They reset when the server restarts and are not shared
// between processes, so this is only correct while the API runs as a single instance. With several
// instances (or a serverless host), move the counters to a shared store such as Redis.

const allLimiters = [];

function retryMessage(action, seconds) {
  const minutes = Math.ceil(seconds / 60);
  return `Too many ${action}. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

// Returns a middleware that allows `limit` requests per `windowMs` for each key.
// - key(req):       what to count by (IP, email, user id). Returning null skips the limiter.
// - action:         used in the 429 message, e.g. 'login attempts'.
// - onlyFailures:   count only requests that end with a 4xx/5xx status (successful ones are refunded).
function createRateLimiter({ windowMs, limit, key, action, onlyFailures = false }) {
  const counters = new Map(); // key -> { count, resetAt }

  function rateLimit(req, res, next) {
    const id = key(req);
    if (id === null || id === undefined) {
      return next();
    }

    const now = Date.now();
    let counter = counters.get(id);
    if (!counter || counter.resetAt <= now) {
      counter = { count: 0, resetAt: now + windowMs };
      counters.set(id, counter);
    }

    if (counter.count >= limit) {
      const retryAfterSeconds = Math.ceil((counter.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      throw new HttpError(429, retryMessage(action, retryAfterSeconds));
    }

    // Counted before the request runs, so parallel requests can't slip past the limit.
    counter.count += 1;
    if (onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode < 400 && counters.get(id) === counter) {
          counter.count -= 1;
        }
      });
    }
    next();
  }

  // Forget expired counters regularly, so random keys (e.g. made-up emails) can't grow memory forever.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, counter] of counters) {
      if (counter.resetAt <= now) {
        counters.delete(id);
      }
    }
  }, windowMs);
  cleanup.unref(); // doesn't keep the process (or a test run) alive

  allLimiters.push(counters);
  return rateLimit;
}

// Clears every counter. Used by tests so one test's requests don't affect the next.
function resetRateLimits() {
  for (const counters of allLimiters) {
    counters.clear();
  }
}

module.exports = { createRateLimiter, resetRateLimits };
