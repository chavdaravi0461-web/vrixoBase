export const SDK_VERSION = '1.0.0'
export const API_VERSION = '1'

export const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Client-Info': `vrixo-sdk/${SDK_VERSION}`,
}

export const STORAGE_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
}

export const AUTH_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
}

export const CONTENT_TYPES = {
  json: 'application/json',
  formData: 'multipart/form-data',
  text: 'text/plain',
  octetStream: 'application/octet-stream',
} as const

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'auth/invalid-credentials',
  AUTH_EMAIL_ALREADY_EXISTS: 'auth/email-already-exists',
  AUTH_USER_NOT_FOUND: 'auth/user-not-found',
  AUTH_WEAK_PASSWORD: 'auth/weak-password',
  AUTH_INVALID_REFRESH_TOKEN: 'auth/invalid-refresh-token',
  AUTH_SESSION_EXPIRED: 'auth/session-expired',
  AUTH_PROVIDER_NOT_FOUND: 'auth/provider-not-found',
  AUTH_MFA_REQUIRED: 'auth/mfa-required',
  STORAGE_BUCKET_NOT_FOUND: 'storage/bucket-not-found',
  STORAGE_FILE_NOT_FOUND: 'storage/file-not-found',
  STORAGE_UPLOAD_FAILED: 'storage/upload-failed',
  STORAGE_OBJECT_NOT_FOUND: 'storage/object-not-found',
  DB_QUERY_FAILED: 'db/query-failed',
  DB_INVALID_FILTER: 'db/invalid-filter',
  DB_TABLE_NOT_FOUND: 'db/table-not-found',
  FUNCTIONS_NOT_FOUND: 'functions/not-found',
  FUNCTIONS_INVOCATION_FAILED: 'functions/invocation-failed',
  REALTIME_CONNECTION_FAILED: 'realtime/connection-failed',
  REALTIME_CHANNEL_ERROR: 'realtime/channel-error',
  UNKNOWN_ERROR: 'unknown/error',
} as const

export const API_ENDPOINTS = {
  auth: {
    signUp: '/auth/v1/signup',
    signIn: '/auth/v1/signin',
    signOut: '/auth/v1/signout',
    session: '/auth/v1/session',
    refresh: '/auth/v1/token/refresh',
    user: '/auth/v1/user',
    resetPassword: '/auth/v1/reset-password',
    oauth: '/auth/v1/oauth',
    verifyOtp: '/auth/v1/verify-otp',
  },
  rest: '/rest/v1',
  storage: '/storage/v1',
  realtime: '/realtime/v1',
  functions: '/functions/v1',
} as const

export const DEFAULT_QUERY_TIMEOUT = 30000
export const DEFAULT_REALTIME_TIMEOUT = 10000
export const DEFAULT_PAGE_LIMIT = 100
export const MAX_PAGE_LIMIT = 1000

export const REALTIME_EVENTS = {
  PRESENCE: 'presence',
  PRESENCE_DIFF: 'presence_diff',
  BROADCAST: 'broadcast',
  POSTGRES_CHANGES: 'postgres_changes',
  SYSTEM: 'system',
  CLOSE: 'close',
  ERROR: 'error',
  JOIN: 'join',
  LEAVE: 'leave',
  REPLY: 'reply',
} as const

export const STORAGE_DEFAULTS = {
  DEFAULT_FILE_OPTIONS: {
    cacheControl: '3600',
    contentType: 'application/octet-stream',
    upsert: false,
  },
  DEFAULT_SEARCH_OPTIONS: {
    sortBy: { column: 'name', order: 'asc' },
  },
} as const
