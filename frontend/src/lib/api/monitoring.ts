import { apiRequest } from './client';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface DatabaseMetrics {
  connections: TimeSeriesPoint[];
  queryCount: TimeSeriesPoint[];
  cacheHitRatio: TimeSeriesPoint[];
}

export interface ApiMetrics {
  requestsOverTime: TimeSeriesPoint[];
  latencyByEndpoint: Array<{ endpoint: string; p50: number; p95: number; p99: number }>;
}

export interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  buckets: Array<{ name: string; size: number; fileCount: number }>;
}

export interface RealtimeMetrics {
  activeConnections: number;
  messagesPerSecond: number;
  channels: number;
}

export interface ErrorEntry {
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'critical';
  source: string;
  timestamp: string;
  count: number;
}

export interface HealthStatus {
  database: { status: 'healthy' | 'degraded' | 'down'; latency?: number };
  redis: { status: 'healthy' | 'degraded' | 'down'; latency?: number };
  minio: { status: 'healthy' | 'degraded' | 'down' };
  backend: { status: 'healthy' | 'degraded' | 'down'; uptime: number; version: string };
}

export async function getDatabaseMetrics(projectId: string): Promise<DatabaseMetrics> {
  return apiRequest<DatabaseMetrics>(`/api/monitoring/${projectId}/database`);
}

export async function getApiMetrics(projectId: string): Promise<ApiMetrics> {
  return apiRequest<ApiMetrics>(`/api/monitoring/${projectId}/api`);
}

export async function getStorageMetrics(projectId: string): Promise<StorageMetrics> {
  return apiRequest<StorageMetrics>(`/api/monitoring/${projectId}/storage`);
}

export async function getRealtimeMetrics(projectId: string): Promise<RealtimeMetrics> {
  return apiRequest<RealtimeMetrics>(`/api/monitoring/${projectId}/realtime`);
}

export async function getErrors(projectId: string, timeframe?: TimeRange): Promise<ErrorEntry[]> {
  return apiRequest<ErrorEntry[]>(`/api/monitoring/${projectId}/errors${timeframe ? `?timeframe=${timeframe}` : ''}`);
}

export async function getHealth(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>('/api/health');
}

export async function getUsage(projectId: string): Promise<any> {
  return apiRequest<any>(`/api/monitoring/${projectId}/usage`);
}
