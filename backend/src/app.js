const express = require('express');
const cors = require('cors');
const { webOrigins, trustProxy } = require('./config/env');
const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const adminReportRoutes = require('./modules/admin-reports/admin-reports.routes');
const statsRoutes = require('./modules/stats/stats.routes');
const userRoutes = require('./modules/users/users.routes');
const { UPLOAD_URL_PREFIX, serveImages } = require('./modules/uploads/uploads.service');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

if (trustProxy > 0) {
  app.set('trust proxy', trustProxy);
}

// Lets the admin web app (a different origin) call the API from the browser. The mobile app does not need CORS.
if (webOrigins.length > 0) {
  app.use(cors({ origin: webOrigins }));
}

app.use(express.json());

app.use(UPLOAD_URL_PREFIX, serveImages);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/stats', statsRoutes);
app.use('/api/admin/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
