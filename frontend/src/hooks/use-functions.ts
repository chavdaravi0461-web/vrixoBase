'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/functions';

export function useFunctions(projectId: string) {
  return useQuery({
    queryKey: ['functions', projectId],
    queryFn: () => api.getFunctions(projectId),
    enabled: !!projectId,
  });
}

export function useFunction(projectId: string, id: string) {
  return useQuery({
    queryKey: ['functions', projectId, id],
    queryFn: () => api.getFunction(projectId, id),
    enabled: !!projectId && !!id,
  });
}

export function useCreateFunction(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateFunctionInput) => api.createFunction(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] });
    },
  });
}

export function useUpdateFunction(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<api.CreateFunctionInput> }) =>
      api.updateFunction(projectId, id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['functions', projectId, id] });
    },
  });
}

export function useDeleteFunction(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFunction(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] });
    },
  });
}

export function useExecuteFunction(projectId: string) {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: any }) =>
      api.executeFunction(projectId, id, payload),
  });
}

export function useExecutionLogs(projectId: string, id: string) {
  return useQuery({
    queryKey: ['functions', projectId, id, 'executions'],
    queryFn: () => api.getExecutionLogs(projectId, id),
    enabled: !!projectId && !!id,
  });
}

export function useWebhooks(projectId: string) {
  return useQuery({
    queryKey: ['functions', projectId, 'webhooks'],
    queryFn: () => api.getWebhooks(projectId),
    enabled: !!projectId,
  });
}

export function useCreateWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; url: string; events: string[]; functionId?: string }) =>
      api.createWebhook(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId, 'webhooks'] });
    },
  });
}

export function useDeleteWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWebhook(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId, 'webhooks'] });
    },
  });
}
