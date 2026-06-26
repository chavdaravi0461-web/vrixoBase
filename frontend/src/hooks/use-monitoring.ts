'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/monitoring';
import type { TimeRange } from '@/lib/api/monitoring';

export function useDatabaseMetrics(projectId: string) {
  return useQuery({
    queryKey: ['monitoring', projectId, 'database'],
    queryFn: () => api.getDatabaseMetrics(projectId),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });
}

export function useApiMetrics(projectId: string) {
  return useQuery({
    queryKey: ['monitoring', projectId, 'api'],
    queryFn: () => api.getApiMetrics(projectId),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });
}

export function useStorageMetrics(projectId: string) {
  return useQuery({
    queryKey: ['monitoring', projectId, 'storage'],
    queryFn: () => api.getStorageMetrics(projectId),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

export function useRealtimeMetrics(projectId: string) {
  return useQuery({
    queryKey: ['monitoring', projectId, 'realtime'],
    queryFn: () => api.getRealtimeMetrics(projectId),
    enabled: !!projectId,
    refetchInterval: 10_000,
  });
}

export function useErrors(projectId: string, timeframe?: TimeRange) {
  return useQuery({
    queryKey: ['monitoring', projectId, 'errors', timeframe],
    queryFn: () => api.getErrors(projectId, timeframe),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30_000,
  });
}

export function useUsage(projectId: string) {
  return useQuery({
    queryKey: ['monitoring', projectId, 'usage'],
    queryFn: () => api.getUsage(projectId),
    enabled: !!projectId,
  });
}
