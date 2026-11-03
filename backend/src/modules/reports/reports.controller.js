const reportsService = require('./reports.service');

async function createReport(req, res) {
  const report = await reportsService.createReport(req.user.id, req.body, req.image);
  res.status(201).json({ report });
}

module.exports = { createReport };
