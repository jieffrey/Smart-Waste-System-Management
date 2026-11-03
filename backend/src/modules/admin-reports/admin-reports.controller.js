const adminReportsService = require('./admin-reports.service');

async function listReports(req, res) {
  const { reports, pagination } = await adminReportsService.listReports(req.validatedQuery);
  res.status(200).json({ reports, pagination });
}

async function getReport(req, res) {
  const report = await adminReportsService.getReport(req.params.id);
  res.status(200).json({ report });
}

async function updateReport(req, res) {
  const report = await adminReportsService.updateReport(req.params.id, req.user.id, req.body);
  res.status(200).json({ report });
}

module.exports = { listReports, getReport, updateReport };
