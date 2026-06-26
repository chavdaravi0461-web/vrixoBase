'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/database';
import type { ColumnDefinition } from '@/lib/api/database';

export function useTables(projectId: string) {
  return useQuery({
    queryKey: ['database', 'tables', projectId],
    queryFn: () => api.getTables(projectId),
    enabled: !!projectId,
  });
}

export function useTable(projectId: string, tableName: string) {
  return useQuery({
    queryKey: ['database', 'tables', projectId, tableName],
    queryFn: () => api.getTable(projectId, tableName),
    enabled: !!projectId && !!tableName,
  });
}

export function useCreateTable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; columns: ColumnDefinition[] }) =>
      api.createTable(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', 'tables', projectId] });
    },
  });
}

export function useDeleteTable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tableName: string) => api.deleteTable(projectId, tableName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', 'tables', projectId] });
    },
  });
}

export function useAddColumn(projectId: string, tableName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ColumnDefinition) => api.addColumn(projectId, tableName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', 'tables', projectId, tableName] });
    },
  });
}

export function useUpdateColumn(projectId: string, tableName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnName, data }: { columnName: string; data: Partial<ColumnDefinition> }) =>
      api.updateColumn(projectId, tableName, columnName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', 'tables', projectId, tableName] });
    },
  });
}

export function useDeleteColumn(projectId: string, tableName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnName: string) => api.deleteColumn(projectId, tableName, columnName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', 'tables', projectId, tableName] });
    },
  });
}

export function useExecuteQuery(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) => api.executeQuery(projectId, query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', 'query', 'history', projectId] });
    },
  });
}

export function useQueryHistory(projectId: string) {
  return useQuery({
    queryKey: ['database', 'query', 'history', projectId],
    queryFn: () => api.getQueryHistory(projectId),
    enabled: !!projectId,
  });
}

export function usePerformance(projectId: string) {
  return useQuery({
    queryKey: ['database', 'performance', projectId],
    queryFn: () => api.getPerformance(projectId),
    enabled: !!projectId,
  });
}

export function useSchema(projectId: string) {
  return useQuery({
    queryKey: ['database', 'schema', projectId],
    queryFn: () => api.getSchema(projectId),
    enabled: !!projectId,
  });
}
