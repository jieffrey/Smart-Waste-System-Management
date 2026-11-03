const reportsService = require('./reports.service');

async function createReport(req, res) {
  const report = await reportsService.createReport(req.user.id, req.body, req.image);
  res.status(201).json({ report });
}

async function listMyReports(req, res) {
  const { reports, pagination } = await reportsService.listUserReports(req.user.id, req.validatedQuery);
  res.status(200).json({ reports, pagination });
}

async function getReport(req, res) {
  const report = await reportsService.getReportForViewer(req.params.id, req.user);
  res.status(200).json({ report });
}

module.exports = { createReport, listMyReports, getReport };
