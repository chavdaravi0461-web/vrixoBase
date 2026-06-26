'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/audit';
import type { AuditLogQuery } from '@/lib/api/audit';

export function useAuditLogs(projectId: string, query?: AuditLogQuery) {
  return useQuery({
    queryKey: ['audit', projectId, query],
    queryFn: () => api.getAuditLogs(projectId, query),
    enabled: !!projectId,
  });
}

export function useAuditLog(projectId: string, id: string) {
  return useQuery({
    queryKey: ['audit', projectId, id],
    queryFn: () => api.getAuditLog(projectId, id),
    enabled: !!projectId && !!id,
  });
}
