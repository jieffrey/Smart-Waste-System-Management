const app = require('./app');
const { port, mlApiUrl } = require('./config/env');

if (!mlApiUrl) {
  console.warn('ML_API_URL is not set: report creation will return 503 until it is configured.');
}

app.listen(port, () => {
  console.log(`SWMS API listening on port ${port}`);
});
