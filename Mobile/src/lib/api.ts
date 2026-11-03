import { API_URL } from '@/constants/api';
import type { ApiErrorBody, FieldError } from '@/types/api';

// Longer than the backend's 30 s ML timeout, so a slow classification still gets its real answer.
const REQUEST_TIMEOUT_MS = 45_000;

// Thrown for every failed request. `status` is 0 when the server could not be reached.
export class ApiError extends Error {
  status: number;
  details: FieldError[] | null;

  constructor(status: number, message: string, details: FieldError[] | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// The session sets these once, so screens and services never pass the token around.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type QueryValue = string | number | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, QueryValue>;
  body?: unknown; // sent as JSON
  formData?: FormData; // sent as multipart/form-data
}

function buildQueryString(query?: Record<string, QueryValue>) {
  if (!query) {
    return '';
  }
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// Turns an error thrown by fetch (no response received) into a message for the user.
// - our own timeout aborted the request
// - a real network failure: expo/fetch throws "fetch failed: ...", React Native's fetch a TypeError
// - anything else happened in the app before sending (e.g. a request body fetch can't send)
function describeRequestError(error: unknown, timedOut: boolean) {
  if (timedOut) {
    return 'The server took too long to respond. Please try again.';
  }
  const message = error instanceof Error ? error.message : '';
  if (error instanceof TypeError || /^fetch failed/i.test(message) || /network request failed/i.test(message)) {
    return "Can't reach the server. Check your internet connection and the API address.";
  }
  return "Couldn't send the request. Please try again.";
}

export async function apiRequest<T>(path: string, { method = 'GET', query, body, formData }: RequestOptions = {}) {
  if (!API_URL) {
    throw new ApiError(0, 'The API address is not set. Add EXPO_PUBLIC_API_URL to Mobile/.env and restart Expo.');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let requestBody: FormData | string | undefined;
  if (formData) {
    requestBody = formData; // fetch sets the multipart Content-Type (with boundary) itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${buildQueryString(query)}`, {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    });
  } catch (error) {
    if (__DEV__) {
      // Shows the real cause in the Expo terminal before it becomes a user-friendly message.
      const { name, message } = error instanceof Error ? error : { name: typeof error, message: String(error) };
      console.warn(`[api] ${method} ${path} failed before a response:`, { name, message });
    }
    throw new ApiError(0, describeRequestError(error, timedOut));
  } finally {
    clearTimeout(timer);
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = data as ApiErrorBody | null;
    if (response.status === 401 && authToken && onUnauthorized) {
      onUnauthorized(); // token expired or invalid: the session signs out
    }
    throw new ApiError(
      response.status,
      errorBody?.error?.message ?? `Request failed (${response.status})`,
      errorBody?.error?.details ?? null
    );
  }

  return data as T;
}
