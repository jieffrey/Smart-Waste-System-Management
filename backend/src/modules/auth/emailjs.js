const { otp } = require('../../config/env');
const HttpError = require('../../utils/http-error');

const SEND_TIMEOUT_MS = 10000;

// Sends the verification code through the EmailJS REST API, from the backend only: the private key
// (accessToken) never leaves the server and the app never talks to EmailJS. EmailJS must allow
// "API calls from non-browser applications" (Account → Security), or it answers 403.
// Template variables: {{to_email}}, {{to_name}}, {{code}}, {{expires_minutes}}.
async function sendVerificationEmail({ toEmail, toName, code, expiresMinutes }) {
  const { apiUrl, serviceId, templateId, publicKey, privateKey } = otp.emailjs;
  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: { to_email: toEmail, to_name: toName, code, expires_minutes: String(expiresMinutes) },
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`EmailJS request failed: ${err.message}`);
    throw new HttpError(503, 'Could not send the verification email. Please try again later');
  }
  if (!response.ok) {
    // The body is EmailJS's own text (e.g. "API calls are disabled for non-browser applications"): log it,
    // never pass it on to the client.
    console.error(`EmailJS answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
    throw new HttpError(503, 'Could not send the verification email. Please try again later');
  }
}

module.exports = { sendVerificationEmail };
