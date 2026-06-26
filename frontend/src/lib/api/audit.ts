import { apiRequest } from './client';

export interface AuditLog {
  id: string;
  projectId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { id: string; email: string; name: string } | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface AuditLogQuery {
  action?: string;
  userId?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(projectId: string, query?: AuditLogQuery): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined) params.set(key, String(val));
    });
  }
  const qs = params.toString();
  return apiRequest<AuditLogsResponse>(`/api/audit/${projectId}${qs ? `?${qs}` : ''}`);
}

export async function getAuditLog(projectId: string, id: string): Promise<AuditLog> {
  return apiRequest<AuditLog>(`/api/audit/${projectId}/${id}`);
}
