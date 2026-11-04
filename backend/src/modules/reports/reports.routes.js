// Mounted at /api/reports (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate, authorizeRole } = require('../../middlewares/auth');
const { uploadImage } = require('../../middlewares/upload');
const { reportLimiter } = require('../../middlewares/limiters');
const { createReportSchema, listMyReportsSchema } = require('./reports.schema');
const reportsController = require('./reports.controller');

const router = Router();

router.post(
  '/',
  authenticate,
  authorizeRole('user'),
  reportLimiter, // before the upload is read, so a limited request costs almost nothing
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

// Defined after '/me' so that '/me' is not treated as an id. Owner or admin only (checked in the service).
router.get('/:id', authenticate, reportsController.getReport);

module.exports = router;
