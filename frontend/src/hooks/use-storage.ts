'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/storage';
import type { CreateBucketInput } from '@/lib/api/storage';

export function useBuckets(projectId: string) {
  return useQuery({
    queryKey: ['storage', 'buckets', projectId],
    queryFn: () => api.getBuckets(projectId),
    enabled: !!projectId,
  });
}

export function useCreateBucket(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBucketInput) => api.createBucket(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'buckets', projectId] });
    },
  });
}

export function useDeleteBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBucket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'buckets'] });
    },
  });
}

export function useFiles(bucketId: string, prefix?: string) {
  return useQuery({
    queryKey: ['storage', 'files', bucketId, prefix],
    queryFn: () => api.getFiles(bucketId, prefix),
    enabled: !!bucketId,
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bucketId, file, isPublic }: { bucketId: string; file: File; isPublic: boolean }) =>
      api.uploadFile(bucketId, file, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] });
    },
  });
}

export function useSignedUrl() {
  return useMutation({
    mutationFn: ({ fileId, expiresIn }: { fileId: string; expiresIn?: number }) =>
      api.getSignedUrl(fileId, expiresIn),
  });
}

export function usePublicUrl() {
  return useMutation({
    mutationFn: (fileId: string) => api.getPublicUrl(fileId),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bucketId, path }: { bucketId: string; path: string }) =>
      api.createFolder(bucketId, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] });
    },
  });
}
