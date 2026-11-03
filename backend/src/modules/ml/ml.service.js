const { mlApiUrl, mlApiKey, mlApiTimeoutMs } = require('../../config/env');
const HttpError = require('../../utils/http-error');

const CATEGORIES = ['organic', 'paper', 'plastic'];
const UNAVAILABLE_MESSAGE = 'Classification service is unavailable, please try again';

function unavailable(reason) {
  // The reason is only logged; the client always gets the same 503 message.
  console.error(`ML API unavailable: ${reason}`);
  return new HttpError(503, UNAVAILABLE_MESSAGE, null);
}

function isValidPrediction(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    CATEGORIES.includes(body.category) &&
    typeof body.confidence === 'number' &&
    body.confidence >= 0 &&
    body.confidence <= 1 &&
    typeof body.model_version === 'string' &&
    body.model_version.length > 0 &&
    body.model_version.length <= 50
  );
}

// Sends the image to POST {ML_API_URL}/predict and returns { category, confidence, modelVersion }.
// Throws a 503 HttpError if the ML API is not configured, down, too slow, or returns an error/invalid result.
async function classifyImage(buffer, mimeType) {
  if (!mlApiUrl) {
    throw unavailable('ML_API_URL is not set');
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), 'image');

  const headers = mlApiKey ? { 'X-API-Key': mlApiKey } : {};

  let body;
  try {
    const response = await fetch(`${mlApiUrl}/predict`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(mlApiTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`responded with status ${response.status}`);
    }
    body = await response.json();
  } catch (err) {
    throw unavailable(err.message);
  }

  if (!isValidPrediction(body)) {
    throw unavailable('invalid prediction in response');
  }

  return { category: body.category, confidence: body.confidence, modelVersion: body.model_version };
}

module.exports = { classifyImage };
