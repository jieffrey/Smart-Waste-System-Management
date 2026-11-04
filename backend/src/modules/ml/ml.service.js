const { mlApiUrl, mlApiKey, mlApiTimeoutMs } = require('../../config/env');
const HttpError = require('../../utils/http-error');

const CATEGORIES = ['organic', 'paper', 'plastic'];
const UNAVAILABLE_MESSAGE = 'AI service unavailable, please try again later';
const IMAGE_REJECTED_MESSAGE = "The photo couldn't be processed. Try another photo.";
// What the ML API answers when the image itself is the problem: 400 corrupt/empty/too many pixels,
// 413 file too large, 415 not a JPEG/PNG/WebP. Any other status (e.g. 401 wrong API key) is our fault.
const IMAGE_REJECTED_STATUSES = [400, 413, 415];

function unavailable(reason) {
  // The reason is only logged; the client always gets the same 503 message.
  console.error(`ML API unavailable: ${reason}`);
  return new HttpError(503, UNAVAILABLE_MESSAGE, null);
}

function imageRejected(status) {
  // The ML API's own error text is never passed on: the client gets one fixed message, on the image field.
  console.warn(`ML API rejected the image (status ${status})`);
  return new HttpError(422, IMAGE_REJECTED_MESSAGE, [{ field: 'image', message: IMAGE_REJECTED_MESSAGE }]);
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
// Throws:
// - 422 (field "image") when the ML API says the image can't be used (400/413/415)
// - 503 when the ML API is not configured, unreachable, too slow, answers 5xx/another status, or
//   returns an invalid result
async function classifyImage(buffer, mimeType) {
  if (!mlApiUrl) {
    throw unavailable('ML_API_URL is not set');
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), 'image');

  const headers = mlApiKey ? { 'X-API-Key': mlApiKey } : {};

  let response;
  try {
    response = await fetch(`${mlApiUrl}/predict`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(mlApiTimeoutMs),
    });
  } catch (err) {
    throw unavailable(err.message); // network error or timeout
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => {}); // the error body is not needed (and never forwarded)
    if (IMAGE_REJECTED_STATUSES.includes(response.status)) {
      throw imageRejected(response.status);
    }
    throw unavailable(`responded with status ${response.status}`);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw unavailable(`unreadable response (${err.message})`); // not JSON, or the timeout hit mid-body
  }

  if (!isValidPrediction(body)) {
    throw unavailable('invalid prediction in response');
  }

  return { category: body.category, confidence: body.confidence, modelVersion: body.model_version };
}

module.exports = { classifyImage };
