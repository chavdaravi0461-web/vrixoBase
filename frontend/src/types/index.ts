// User & Auth
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
}

// Projects
export type ProjectPlan = 'free' | 'pro' | 'team' | 'enterprise';
export type ProjectStatus = 'active' | 'paused' | 'suspended' | 'deleted';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan: ProjectPlan;
  status: ProjectStatus;
  region: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  member_count?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  user: User;
  joined_at: string;
}

// Database / Tables
export type ColumnType =
  | 'text'
  | 'integer'
  | 'bigint'
  | 'boolean'
  | 'float'
  | 'double'
  | 'decimal'
  | 'timestamp'
  | 'date'
  | 'json'
  | 'jsonb'
  | 'uuid'
  | 'serial'
  | 'bigserial';

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
  is_unique: boolean;
  foreign_key?: {
    table: string;
    column: string;
  };
}

export interface TableIndex {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface Table {
  id: string;
  name: string;
  schema: string;
  description?: string;
  columns: Column[];
  indexes: TableIndex[];
  row_count: number;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface TableRow {
  [key: string]: unknown;
}

// Storage / Buckets
export type BucketVisibility = 'public' | 'private';

export interface Bucket {
  id: string;
  name: string;
  project_id: string;
  visibility: BucketVisibility;
  file_size_limit?: number;
  allowed_mime_types?: string[];
  created_at: string;
  updated_at: string;
}

export interface FileObject {
  id: string;
  name: string;
  bucket_id: string;
  project_id: string;
  size: number;
  mime_type: string;
  path: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  url?: string;
}

// Edge Functions
export type FunctionStatus = 'active' | 'deploying' | 'failed' | 'inactive';

export interface EdgeFunction {
  id: string;
  name: string;
  slug: string;
  project_id: string;
  runtime: 'node' | 'deno' | 'python';
  status: FunctionStatus;
  source: string;
  entrypoint: string;
  timeout_seconds: number;
  memory_mb: number;
  environment_variables?: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_deployed_at?: string;
  invocation_count?: number;
}

export interface FunctionInvocation {
  id: string;
  function_id: string;
  status: 'success' | 'error';
  duration_ms: number;
  triggered_at: string;
  error_message?: string;
}

// Realtime
export type RealtimeChannelType = 'broadcast' | 'presence' | 'postgres_changes';

export interface RealtimeChannel {
  id: string;
  project_id: string;
  name: string;
  type: RealtimeChannelType;
  config: Record<string, unknown>;
  created_at: string;
}

// API Keys
export type ApiKeyPermission = 'read' | 'write' | 'admin';

export interface ApiKey {
  id: string;
  name: string;
  type: 'SECRET' | 'PUBLIC';
  key: string;
  lastUsedAt?: string;
  createdAt: string;
  revoked: boolean;
  projectId?: string;
  prefix?: string;
  permissions?: ApiKeyPermission[];
  expiresAt?: string;
}

// Analytics
export interface AnalyticsQuery {
  project_id: string;
  metric: string;
  start_date: string;
  end_date: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsDataPoint {
  timestamp: string;
  value: number;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, string[]>;
}

export interface DashboardStats {
  total_projects: number;
  total_tables: number;
  total_rows: number;
  total_storage_bytes: number;
  total_functions: number;
  active_connections: number;
  daily_active_users: number;
  requests_last_hour: number;
}
