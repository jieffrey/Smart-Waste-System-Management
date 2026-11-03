// Mounted at /api/admin/reports (see app.js)
const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate, authorizeRole } = require('../../middlewares/auth');
const { listReportsSchema } = require('./admin-reports.schema');
const adminReportsController = require('./admin-reports.controller');

const router = Router();

// Every route in this file is for admins only.
router.use(authenticate, authorizeRole('admin'));

router.get('/', validate(listReportsSchema, 'query'), adminReportsController.listReports);
router.get('/:id', adminReportsController.getReport);

module.exports = router;
