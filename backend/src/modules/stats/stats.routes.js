// Mounted at /api/admin/stats (see app.js)
const { Router } = require('express');
const { authenticate, authorizeRole } = require('../../middlewares/auth');
const statsController = require('./stats.controller');

const router = Router();

// Every route in this file is for admins only.
router.use(authenticate, authorizeRole('admin'));

router.get('/', statsController.getStats);

module.exports = router;
