const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(access: string, refresh: string): void;
  clearTokens(): void;
}

const defaultStore: TokenStore = {
  getAccessToken: () => (typeof window !== 'undefined' ? localStorage.getItem('vrixo_access_token') : null),
  getRefreshToken: () => (typeof window !== 'undefined' ? localStorage.getItem('vrixo_refresh_token') : null),
  setTokens: (access, refresh) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('vrixo_access_token', access);
    localStorage.setItem('vrixo_refresh_token', refresh);
  },
  clearTokens: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('vrixo_access_token');
    localStorage.removeItem('vrixo_refresh_token');
    localStorage.removeItem('vrixo_user');
  },
};

type RefreshState = { promise: Promise<string | null> } | null;
let refreshState: RefreshState = null;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = defaultStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        defaultStore.clearTokens();
      }
      return null;
    }

    const body = await res.json();
    const data = body.data || body;

    if (data.accessToken && data.refreshToken) {
      defaultStore.setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return defaultStore.getAccessToken();
}

export function clearAuth(): void {
  defaultStore.clearTokens();
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit & { rawResponse?: boolean },
): Promise<T> {
  const token = defaultStore.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const { rawResponse, ...fetchOptions } = options || {};

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (res.status === 401 && token && typeof window !== 'undefined') {
    if (!refreshState) {
      refreshState = { promise: doRefresh() };
    }

    const newToken = await refreshState.promise;
    refreshState = null;

    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...fetchOptions,
        headers,
      });
    } else {
      onRefreshed(null);
      throw new Error('Session expired');
    }
  }

  if (rawResponse) {
    return res as unknown as T;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const messages = body.message
      ? Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message
      : `Request failed: ${res.status}`;
    throw new Error(messages);
  }

  return (body.data ?? body) as T;
}

export const apiClient = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
