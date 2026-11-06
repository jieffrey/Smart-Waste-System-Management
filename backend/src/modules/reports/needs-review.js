const { aiReviewThreshold } = require('../../config/env');

// A report "needs review" when the AI was unsure (confidence below AI_REVIEW_THRESHOLD) and no admin has
// confirmed or corrected its category yet. Computed, not stored:
// - corrected  = the category differs from the AI's (the admin changed it);
// - confirmed  = the report left `pending` (an admin routed it: in progress, completed or rejected), which
//                means they looked at it and kept, or changed, the category.
// So: AI confidence < threshold AND category = AI category AND status = 'pending'.
// The threshold is a validated number from the config (not user input), so it is inlined as a literal.
function needsReviewSql(prefix = '') {
  const threshold = Number(aiReviewThreshold).toFixed(4);
  return `(${prefix}ai_confidence IS NOT NULL
    AND ${prefix}ai_confidence < ${threshold}
    AND ${prefix}category = ${prefix}ai_predicted_category
    AND ${prefix}status = 'pending')`;
}

module.exports = { needsReviewSql };
