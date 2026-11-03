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

export function getMe() {
  return apiRequest<{ user: User }>('/api/auth/me');
}
