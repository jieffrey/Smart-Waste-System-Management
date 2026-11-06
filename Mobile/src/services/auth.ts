import { apiRequest } from '@/lib/api';
import type { AuthResponse, User } from '@/types/api';

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function register(fullName: string, email: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/register', {
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

export function getMe() {
  return apiRequest<{ user: User }>('/api/auth/me');
}
