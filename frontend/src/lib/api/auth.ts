import { apiRequest } from './client';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(data: { email: string; password: string; name: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout() {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('vrixo_refresh_token') : null;
  try {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Swallow logout errors
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vrixo_access_token');
      localStorage.removeItem('vrixo_refresh_token');
      localStorage.removeItem('vrixo_user');
    }
  }
}

export async function refreshToken(token?: string): Promise<{ accessToken: string; refreshToken: string }> {
  const refresh_token = token || (typeof window !== 'undefined' ? localStorage.getItem('vrixo_refresh_token') : null);
  if (!refresh_token) throw new Error('No refresh token available');

  return apiRequest<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refresh_token }),
  });
}

export async function getMe(): Promise<AuthResponse['user']> {
  return apiRequest<AuthResponse['user']>('/api/auth/me');
}

export async function googleLogin() {
  window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/google`;
}

export async function githubLogin() {
  window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/github`;
}
