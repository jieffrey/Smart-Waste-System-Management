import { t, translateBackendMessage } from '@/constants/strings';
import { ApiError } from '@/lib/api';

// One place to turn any error into text for the user and per-field messages for forms.

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return translateBackendMessage(error.message);
  }
  return t.common.genericError;
}

// { email: 'Email is invalid', ... } from the backend's error.details (first message per field).
export function getFieldErrors(error: unknown) {
  const fieldErrors: Record<string, string> = {};
  if (error instanceof ApiError && error.details) {
    for (const { field, message } of error.details) {
      fieldErrors[field] ??= translateBackendMessage(message);
    }
  }
  return fieldErrors;
}
