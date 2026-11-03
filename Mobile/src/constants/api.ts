// Base URL of the backend, e.g. http://192.168.1.51:4000 (set in Mobile/.env, see .env.example).
// It must be read exactly as `process.env.EXPO_PUBLIC_API_URL` so Expo can build it into the app.
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export const API_URL = rawApiUrl.trim().replace(/\/+$/, '');

export const isApiUrlConfigured = API_URL.length > 0;
