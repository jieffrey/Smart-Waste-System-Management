const statsService = require('./stats.service');

async function getStats(req, res) {
  const { totals, reports_per_day, ai_accuracy } = await statsService.getStats();
  res.status(200).json({ totals, reports_per_day, ai_accuracy });
}

module.exports = { getStats };
