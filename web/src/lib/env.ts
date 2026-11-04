// Base URL of the backend API, without a trailing slash. Set NEXT_PUBLIC_API_URL in web/.env (see .env.example).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
