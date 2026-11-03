// Mounted at /api/reports (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate, authorizeRole } = require('../../middlewares/auth');
const { uploadImage } = require('../../middlewares/upload');
const { createReportSchema, listMyReportsSchema } = require('./reports.schema');
const reportsController = require('./reports.controller');

const router = Router();

router.post(
  '/',
  authenticate,
  authorizeRole('user'),
  uploadImage,
  validate(createReportSchema),
  reportsController.createReport
);

router.get(
  '/me',
  authenticate,
  authorizeRole('user'),
  validate(listMyReportsSchema, 'query'),
  reportsController.listMyReports
);

module.exports = router;
