// A fake ML API for tests, so no real ML server is needed.
// Set `state.mode` to control how POST /predict answers:
//   'success' -> 200 with state.prediction
//   'error'   -> 500
//   'invalid' -> 200 with an invalid prediction
//   'slow'    -> 200, but only after state.delayMs (to trigger the client timeout)
//   'status'  -> state.status with an ML-style error body containing RAW_ML_ERROR_TEXT

const http = require('node:http');

// Raw ML error text: tests check that it never reaches the backend's clients.
const RAW_ML_ERROR_TEXT = 'Image dimensions are too large (raw ML detail)';

const DEFAULT_PREDICTION = {
  category: 'plastic',
  confidence: 0.9981,
  probabilities: { organic: 0.0011, paper: 0.0008, plastic: 0.9981 },
  model_version: 'swms_mobilenetv2_best',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function startFakeMlApi() {
  const state = { mode: 'success', prediction: DEFAULT_PREDICTION, delayMs: 1000, status: 400, requests: [] };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      state.requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) });

      if (state.mode === 'error') {
        return sendJson(res, 500, { error: { message: 'Internal server error' } });
      }
      if (state.mode === 'status') {
        return sendJson(res, state.status, { error: { message: RAW_ML_ERROR_TEXT } });
      }
      if (state.mode === 'invalid') {
        return sendJson(res, 200, { category: 'metal', confidence: 2 });
      }
      if (state.mode === 'slow') {
        setTimeout(() => sendJson(res, 200, state.prediction), state.delayMs);
        return;
      }
      sendJson(res, 200, state.prediction);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      resolve({
        state,
        url: `http://localhost:${server.address().port}`,
        close: () => {
          server.closeAllConnections();
          return new Promise((done) => server.close(done));
        },
      });
    });
  });
}

module.exports = { startFakeMlApi, DEFAULT_PREDICTION, RAW_ML_ERROR_TEXT };
