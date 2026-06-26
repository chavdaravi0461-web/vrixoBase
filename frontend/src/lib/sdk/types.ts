export interface VrixoClientOptions {
  url: string
  anonKey: string
  headers?: Record<string, string>
  autoRefreshToken?: boolean
  persistSession?: boolean
  realtime?: {
    transport?: 'websocket' | 'polling'
    timeout?: number
  }
  db?: {
    schema?: string
  }
  global?: {
    fetch?: typeof fetch
    headers?: Record<string, string>
  }
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  token_type: string
  user: User
}

export interface User {
  id: string
  email?: string
  phone?: string
  created_at: string
  updated_at?: string
  email_confirmed_at?: string
  phone_confirmed_at?: string
  confirmed_at?: string
  last_sign_in_at?: string
  role?: string
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
  identities?: Identity[]
  factors?: Factor[]
}

export interface Identity {
  id: string
  provider: string
  identity_id: string
  user_id: string
  created_at: string
  last_sign_in_at?: string
  updated_at?: string
}

export interface Factor {
  id: string
  type: string
  created_at: string
  updated_at?: string
  status: string
}

export type AuthResponse =
  | { data: { session: Session; user: User }; error: null }
  | { data: null; error: AuthError }

export type AuthTokenResponse =
  | { data: { session: Session }; error: null }
  | { data: null; error: AuthError }

export type AuthOAuthResponse =
  | { data: { url: string; provider: OAuthProvider }; error: null }
  | { data: null; error: AuthError }

export type UserResponse =
  | { data: { user: User }; error: null }
  | { data: null; error: AuthError }

export type SessionResponse =
  | { data: { session: Session | null }; error: null }
  | { data: null; error: AuthError }

export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export type OAuthProvider = 'google' | 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'discord' | 'facebook' | 'twitter'

export interface SignUpOptions {
  redirectTo?: string
  data?: Record<string, unknown>
  captchaToken?: string
}

export interface SignInWithOAuthOptions {
  redirectTo?: string
  scopes?: string
  queryParams?: Record<string, string>
}

export interface ResetPasswordOptions {
  redirectTo?: string
  captchaToken?: string
}

export type QueryOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'cs'
  | 'cd'
  | 'sl'
  | 'sr'
  | 'nxr'
  | 'nxl'
  | 'adj'

export interface FilterDefinition {
  column: string
  operator: QueryOperator
  value: unknown
}

export type OrderDirection = 'asc' | 'desc'

export interface OrderDefinition {
  column: string
  ascending?: boolean
  nullsFirst?: boolean
}

export interface QueryResponse<T = unknown> {
  data: T | null
  error: PostgrestError | null
  count: number | null
  status: number
  statusText: string
}

export class PostgrestError extends Error {
  constructor(
    message: string,
    public details?: string,
    public hint?: string,
    public code?: string
  ) {
    super(message)
    this.name = 'PostgrestError'
  }
}

export type GenericResponse<T> = {
  data: T | null
  error: Error | null
}

export interface Bucket {
  id: string
  name: string
  owner?: string
  public: boolean
  file_size_limit?: number
  allowed_mime_types?: string[]
  created_at: string
  updated_at?: string
}

export interface FileObject {
  id: string
  name: string
  bucket_id: string
  owner?: string
  created_at: string
  updated_at?: string
  last_accessed_at?: string
  metadata?: Record<string, unknown>
  size?: number
  mimetype?: string
}

export interface FileOptions {
  cacheControl?: string
  contentType?: string
  upsert?: boolean
  duplex?: string
  metadata?: Record<string, unknown>
  headers?: Record<string, string>
}

export interface SearchOptions {
  sortBy?: { column?: string; order?: string }
  filter?: { column?: string; operator?: string; value?: string }
}

export type SortBy = { column?: string; order?: 'asc' | 'desc' }

export interface DownloadOptions {
  transform?: {
    width?: number
    height?: number
    resize?: 'cover' | 'contain' | 'fill'
    format?: 'origin' | 'avif' | 'jpg' | 'png' | 'webp'
    quality?: number
  }
}

export type StorageError = Error

export interface RealtimeChannel {
  id: string
  topic: string
  event?: string
  payload?: Record<string, unknown>
}

export interface RealtimePresence {
  key: string
  user: string
  online_at: string
  state: Record<string, unknown>
}

export interface RealtimePresenceState {
  presences: RealtimePresence[]
}

export type RealtimeEvent =
  | 'presence'
  | 'presence_diff'
  | 'broadcast'
  | 'system'
  | string

export interface RealtimePostgresChangesPayload {
  schema: string
  table: string
  event_type: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
  errors?: string[]
}

export interface FunctionDefinition {
  id: string
  name: string
  slug: string
  version: number
  status: 'active' | 'inactive' | 'error'
  created_at: string
  updated_at?: string
  entrypoint_path: string
  import_map_path?: string
}

export interface FunctionResponse<T = unknown> {
  data: T | null
  error: FunctionError | null
}

export class FunctionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public httpStatus?: number
  ) {
    super(message)
    this.name = 'FunctionError'
  }
}

export interface FunctionMetrics {
  invocations: number
  errors: number
  avg_execution_time_ms: number
  last_invoked_at?: string
}

export type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'

export type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => void

export interface Subscription {
  unsubscribe: () => void
}

export interface PostgrestFilterBuilder<T = Record<string, unknown>> extends PromiseLike<QueryResponse<T[]>> {
  eq: (column: keyof T, value: unknown) => this
  neq: (column: keyof T, value: unknown) => this
  gt: (column: keyof T, value: unknown) => this
  gte: (column: keyof T, value: unknown) => this
  lt: (column: keyof T, value: unknown) => this
  lte: (column: keyof T, value: unknown) => this
  like: (column: keyof T, pattern: string) => this
  ilike: (column: keyof T, pattern: string) => this
  isNull: (column: keyof T) => this
  isNotNull: (column: keyof T) => this
  in: (column: keyof T, values: unknown[]) => this
  textSearch: (column: keyof T, query: string, options?: { type?: 'plain' | 'phrase' | 'websearch'; config?: string }) => this
  order: (column: keyof T, opts?: { ascending?: boolean; nullsFirst?: boolean }) => this
  limit: (count: number) => this
  offset: (start: number) => this
  range: (from: number, to: number) => this
  single: () => this
  maybeSingle: () => this
  select: (columns?: string) => this
}
