// AI_REVIEW_THRESHOLD: reports whose AI confidence is below this (0–1) "need review" by an admin.
// Default 0.70. Anything that isn't a number in (0, 1] stops the server at startup.
function readAiReviewThreshold(raw) {
  if (raw === undefined || raw.trim() === '') {
    return 0.7;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error('AI_REVIEW_THRESHOLD must be a number between 0 and 1 (for example 0.70).');
  }
  return value;
}

module.exports = { readAiReviewThreshold };
