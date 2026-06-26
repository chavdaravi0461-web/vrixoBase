import type {
  AuthResponse,
  AuthOAuthResponse,
  SessionResponse,
  UserResponse,
  Session,
  User,
  OAuthProvider,
  SignUpOptions,
  SignInWithOAuthOptions,
  ResetPasswordOptions,
  AuthChangeEvent,
  AuthChangeCallback,
  Subscription,
} from './types'
import { AuthError } from './types'
import { API_ENDPOINTS, DEFAULT_HEADERS } from './constants'

const TOKEN_KEY = 'vrixo-auth-token'

export class AuthClient {
  private url: string
  private anonKey: string
  private headers: Record<string, string>
  private currentSession: Session | null = null
  private listeners: Map<string, AuthChangeCallback> = new Map()
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private autoRefreshToken: boolean

  constructor(url: string, anonKey: string, options?: { headers?: Record<string, string>; autoRefreshToken?: boolean }) {
    this.url = url.replace(/\/$/, '')
    this.anonKey = anonKey
    this.headers = { ...DEFAULT_HEADERS, ...options?.headers }
    this.autoRefreshToken = options?.autoRefreshToken ?? true

    const stored = this.loadSession()
    if (stored) {
      this.currentSession = stored
      this.notifyListeners('INITIAL_SESSION', stored)
      this.startAutoRefresh()
    }
  }

  async signUp(email: string, password: string, options?: SignUpOptions): Promise<AuthResponse> {
    try {
      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.signUp}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
        },
        body: JSON.stringify({
          email,
          password,
          options: {
            redirect_to: options?.redirectTo,
            data: options?.data,
          },
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new AuthError(body.message || body.error_description || 'Sign up failed', res.status, body.code),
        }
      }

      const session = this.buildSession(body)
      this.setSession(session)
      this.notifyListeners('SIGNED_IN', session)

      return {
        data: { session, user: session.user },
        error: null,
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof AuthError ? err : new AuthError('Network error during sign up', 0),
      }
    }
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.signIn}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
        },
        body: JSON.stringify({ email, password }),
      })

      const body = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new AuthError(body.message || body.error_description || 'Sign in failed', res.status, body.code),
        }
      }

      const session = this.buildSession(body)
      this.setSession(session)
      this.notifyListeners('SIGNED_IN', session)

      return {
        data: { session, user: session.user },
        error: null,
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof AuthError ? err : new AuthError('Network error during sign in', 0),
      }
    }
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const token = this.currentSession?.access_token
      if (token) {
        await fetch(`${this.url}${API_ENDPOINTS.auth.signOut}`, {
          method: 'POST',
          headers: {
            ...this.headers,
            'apikey': this.anonKey,
            'Authorization': `Bearer ${token}`,
          },
        })
      }
    } catch {
      // Continue with sign out even if request fails
    }

    this.clearSession()
    this.notifyListeners('SIGNED_OUT', null)
    return { error: null }
  }

  async getSession(): Promise<SessionResponse> {
    const token = this.currentSession?.access_token
    if (!token) {
      return {
        data: { session: null },
        error: null,
      }
    }

    try {
      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.session}`, {
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        this.clearSession()
        return {
          data: { session: null },
          error: null,
        }
      }

      const body = await res.json()
      const session = this.buildSession(body)
      this.setSession(session)
      return {
        data: { session },
        error: null,
      }
    } catch {
      return {
        data: { session: this.currentSession },
        error: null,
      }
    }
  }

  onAuthStateChange(callback: AuthChangeCallback): Subscription {
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
    this.listeners.set(id, callback)

    if (this.currentSession) {
      setTimeout(() => callback('INITIAL_SESSION', this.currentSession), 0)
    }

    return {
      unsubscribe: () => {
        this.listeners.delete(id)
      },
    }
  }

  async signInWithOAuth(provider: OAuthProvider, options?: SignInWithOAuthOptions): Promise<AuthOAuthResponse> {
    try {
      const params = new URLSearchParams({
        provider,
        redirect_to: options?.redirectTo || window.location.origin,
        scopes: options?.scopes || '',
        ...options?.queryParams,
      })

      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.oauth}?${params}`, {
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
        },
      })

      const body = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new AuthError(body.message || body.error_description || 'OAuth sign in failed', res.status, body.code),
        }
      }

      if (body.url) {
        window.location.href = body.url
      }

      return {
        data: { url: body.url, provider },
        error: null,
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof AuthError ? err : new AuthError('Network error during OAuth sign in', 0),
      }
    }
  }

  async refreshSession(): Promise<SessionResponse> {
    const refreshToken = this.currentSession?.refresh_token
    if (!refreshToken) {
      return {
        data: null,
        error: new AuthError('No refresh token available', 400, ERROR_CODES_MAP.AUTH_INVALID_REFRESH_TOKEN),
      }
    }

    try {
      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.refresh}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      const body = await res.json()

      if (!res.ok) {
        this.clearSession()
        this.notifyListeners('SIGNED_OUT', null)
      return {
        data: null,
        error: new AuthError(body?.message || 'Token refresh failed', res.status, body?.code),
      }
      }

      const session = this.buildSession(body)
      this.setSession(session)
      this.notifyListeners('TOKEN_REFRESHED', session)
      return {
        data: { session },
        error: null,
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof AuthError ? err : new AuthError('Network error during token refresh', 0),
      }
    }
  }

  async resetPassword(email: string, options?: ResetPasswordOptions): Promise<{ data: null; error: AuthError | null }> {
    try {
      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.resetPassword}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
        },
        body: JSON.stringify({
          email,
          options: {
            redirect_to: options?.redirectTo,
          },
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        return {
          data: null,
          error: new AuthError(body.message || 'Password reset failed', res.status, body.code),
        }
      }

      return { data: null, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof AuthError ? err : new AuthError('Network error during password reset', 0),
      }
    }
  }

  async getUser(): Promise<UserResponse> {
    const token = this.currentSession?.access_token
    if (!token) {
      return {
        data: null,
        error: new AuthError('Not authenticated', 401, 'auth/not-authenticated'),
      }
    }

    try {
      const res = await fetch(`${this.url}${API_ENDPOINTS.auth.user}`, {
        headers: {
          ...this.headers,
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`,
        },
      })

      const body = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new AuthError(body.message || 'Failed to get user', res.status, body.code),
        }
      }

      return {
        data: { user: body as User },
        error: null,
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof AuthError ? err : new AuthError('Network error', 0),
      }
    }
  }

  getCurrentSession(): Session | null {
    return this.currentSession
  }

  getAnonKey(): string {
    return this.anonKey
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.headers, 'apikey': this.anonKey }
    if (this.currentSession?.access_token) {
      headers['Authorization'] = `Bearer ${this.currentSession.access_token}`
    }
    return headers
  }

  private setSession(session: Session): void {
    this.currentSession = session
    this.saveSession(session)
    this.startAutoRefresh()
  }

  private clearSession(): void {
    this.currentSession = null
    this.removeSession()
    this.stopAutoRefresh()
  }

  private notifyListeners(event: AuthChangeEvent, session: Session | null): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event, session)
      } catch {
        // Swallow listener errors
      }
    })
  }

  private buildSession(body: Record<string, unknown>): Session {
    const user = body.user as User
    return {
      access_token: body.access_token as string,
      refresh_token: body.refresh_token as string,
      expires_in: (body.expires_in as number) || 3600,
      expires_at: body.expires_at as number | undefined,
      token_type: (body.token_type as string) || 'bearer',
      user: user || (body as unknown as User),
    }
  }

  private startAutoRefresh(): void {
    if (!this.autoRefreshToken || !this.currentSession) return
    this.stopAutoRefresh()
    const expiresIn = this.currentSession.expires_in
    const refreshInterval = (expiresIn - 60) * 1000
    if (refreshInterval > 0) {
      this.refreshTimer = setInterval(() => {
        this.refreshSession()
      }, refreshInterval)
    }
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  private saveSession(session: Session): void {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
    } catch {
      // LocalStorage may not be available
    }
  }

  private loadSession(): Session | null {
    try {
      const stored = localStorage.getItem(TOKEN_KEY)
      if (stored) {
        return JSON.parse(stored) as Session
      }
    } catch {
      // Ignore parse errors
    }
    return null
  }

  private removeSession(): void {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // LocalStorage may not be available
    }
  }
}

const ERROR_CODES_MAP = {
  AUTH_INVALID_REFRESH_TOKEN: 'auth/invalid-refresh-token',
} as const
