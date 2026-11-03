// Mounted at /api/reports (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate, authorizeRole } = require('../../middlewares/auth');
const { uploadImage } = require('../../middlewares/upload');
const { createReportSchema } = require('./reports.schema');
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

module.exports = router;
