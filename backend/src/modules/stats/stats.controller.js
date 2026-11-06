const statsService = require('./stats.service');

async function getStats(req, res) {
  const { totals, reports_per_day, ai_accuracy, ai_flow, needs_review } = await statsService.getStats();
  res.status(200).json({ totals, reports_per_day, ai_accuracy, ai_flow, needs_review });
}

module.exports = { getStats };
