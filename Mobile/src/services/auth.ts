import { apiRequest } from '@/lib/api';
import type { AuthResponse, User, VerificationRequiredResponse } from '@/types/api';

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function register(fullName: string, email: string, password: string) {
  return apiRequest<AuthResponse | VerificationRequiredResponse>('/api/auth/register', {
    method: 'POST',
    body: { full_name: fullName, email, password },
  });
}

export function updateProfile(changes: { full_name?: string; email?: string }) {
  return apiRequest<{ user: User }>('/api/auth/me', { method: 'PATCH', body: changes });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function verifyEmail(email: string, code: string) {
  return apiRequest<AuthResponse>('/api/auth/verify-email', { method: 'POST', body: { email, code } });
}

export function resendCode(email: string) {
  return apiRequest<{ message: string }>('/api/auth/resend-code', { method: 'POST', body: { email } });
}

export function getMe() {
  return apiRequest<{ user: User }>('/api/auth/me');
}
