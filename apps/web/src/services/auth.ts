// ============================================================================
// Auth Service
// ============================================================================

import { api } from './api';

export interface AuthResponse {
  data: {
    user: { id: string; email: string; displayName: string; role: string };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface ProfileResponse {
  data: { id: string; email: string; displayName: string; role: string; createdAt: string };
}

export const authService = {
  requestOtp(email: string, displayName: string) {
    return api.post<{ data: { message: string } }>('/auth/request-otp', { email, displayName });
  },
  register(email: string, otp: string, password: string, displayName: string) {
    return api.post<AuthResponse>('/auth/register', { email, otp, password, displayName });
  },
  login(email: string, password: string) {
    return api.post<AuthResponse>('/auth/login', { email, password });
  },
  logout(refreshToken: string) {
    return api.post('/auth/logout', { refreshToken });
  },
  refresh(refreshToken: string) {
    return api.post<{ data: { accessToken: string; refreshToken: string; expiresIn: number } }>(
      '/auth/refresh',
      { refreshToken },
    );
  },
  getProfile() {
    return api.get<ProfileResponse>('/auth/me');
  },
  forgotPassword(email: string) {
    return api.post<{ data: { message: string } }>('/auth/forgot-password', { email });
  },
  resetPassword(token: string, password: string) {
    return api.post<{ data: { message: string } }>('/auth/reset-password', { token, password });
  },
};
