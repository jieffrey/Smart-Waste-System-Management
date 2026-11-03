const express = require('express');
const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const adminReportRoutes = require('./modules/admin-reports/admin-reports.routes');
const { UPLOAD_URL_PREFIX, serveImages } = require('./modules/uploads/uploads.service');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

app.use(express.json());

app.use(UPLOAD_URL_PREFIX, serveImages);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', adminReportRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
