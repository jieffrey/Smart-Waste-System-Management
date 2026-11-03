const adminReportsService = require('./admin-reports.service');

async function listReports(req, res) {
  const { reports, pagination } = await adminReportsService.listReports(req.validatedQuery);
  res.status(200).json({ reports, pagination });
}

module.exports = { listReports };
