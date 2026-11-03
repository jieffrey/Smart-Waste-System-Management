const express = require('express');
const authRoutes = require('./modules/auth/auth.routes');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
