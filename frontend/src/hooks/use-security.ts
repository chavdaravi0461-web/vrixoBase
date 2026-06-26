'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/security';
import type { CreatePolicyInput, CreateSecretInput } from '@/lib/api/security';

export function usePolicies(projectId: string, tableName?: string) {
  return useQuery({
    queryKey: ['security', projectId, 'policies', tableName],
    queryFn: () => api.getPolicies(projectId, tableName),
    enabled: !!projectId,
  });
}

export function useCreatePolicy(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyInput) => api.createPolicy(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', projectId, 'policies'] });
    },
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePolicy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security'] });
    },
  });
}

export function useSecrets(projectId: string) {
  return useQuery({
    queryKey: ['security', projectId, 'secrets'],
    queryFn: () => api.getSecrets(projectId),
    enabled: !!projectId,
  });
}

export function useCreateSecret(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSecretInput) => api.createSecret(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', projectId, 'secrets'] });
    },
  });
}

export function useDeleteSecret(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSecret(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', projectId, 'secrets'] });
    },
  });
}
