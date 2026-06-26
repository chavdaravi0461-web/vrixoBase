'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/api-keys';
import type { CreateApiKeyInput } from '@/lib/api/api-keys';

export function useApiKeys(projectId: string) {
  return useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => api.getApiKeys(projectId),
    enabled: !!projectId,
  });
}

export function useCreateApiKey(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => api.createApiKey(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });
}

export function useRevokeApiKey(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revokeApiKey(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });
}
