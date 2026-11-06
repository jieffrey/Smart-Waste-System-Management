// Email verification (OTP). Off by default: with OTP_ENABLED unset or not "true", registration and login work
// exactly as before. When it is on, every EmailJS setting is required (the server refuses to start otherwise).
function readOtpConfig(env) {
  const enabled = (env.OTP_ENABLED || '').trim().toLowerCase() === 'true';
  const emailjs = {
    apiUrl: (env.EMAILJS_API_URL || 'https://api.emailjs.com/api/v1.0/email/send').trim(),
    serviceId: (env.EMAILJS_SERVICE_ID || '').trim(),
    templateId: (env.EMAILJS_TEMPLATE_ID || '').trim(),
    publicKey: (env.EMAILJS_PUBLIC_KEY || '').trim(),
    privateKey: (env.EMAILJS_PRIVATE_KEY || '').trim(),
  };
  if (enabled) {
    const missing = Object.entries({
      EMAILJS_SERVICE_ID: emailjs.serviceId,
      EMAILJS_TEMPLATE_ID: emailjs.templateId,
      EMAILJS_PUBLIC_KEY: emailjs.publicKey,
      EMAILJS_PRIVATE_KEY: emailjs.privateKey,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`OTP_ENABLED=true needs ${missing.join(', ')}.`);
    }
  }
  return { enabled, emailjs };
}

module.exports = { readOtpConfig };
