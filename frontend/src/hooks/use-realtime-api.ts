'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/realtime';

export function useSubscriptions(projectId: string) {
  return useQuery({
    queryKey: ['realtime', projectId, 'subscriptions'],
    queryFn: () => api.getSubscriptions(projectId),
    enabled: !!projectId,
  });
}

export function useCreateSubscription(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tableId?: string; eventType: string; endpoint?: string }) =>
      api.createSubscription(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realtime', projectId, 'subscriptions'] });
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realtime'] });
    },
  });
}

export function useConnections(projectId: string) {
  return useQuery({
    queryKey: ['realtime', projectId, 'connections'],
    queryFn: () => api.getConnections(projectId),
    enabled: !!projectId,
    refetchInterval: 10_000,
  });
}

export function usePresence(projectId: string) {
  return useQuery({
    queryKey: ['realtime', projectId, 'presence'],
    queryFn: () => api.getPresence(projectId),
    enabled: !!projectId,
    refetchInterval: 10_000,
  });
}
