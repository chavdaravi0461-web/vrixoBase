import { apiRequest, getApiBaseUrl } from './client';

export interface Bucket {
  id: string;
  name: string;
  isPublic: boolean;
  allowedMimeTypes: string[] | null;
  maxFileSize: number | null;
  createdAt: string;
  totalSize?: number;
  fileCount?: number;
  _count?: { files: number };
}

export interface StorageFile {
  id: string;
  name: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  createdAt: string;
  isFolder?: boolean;
  url?: string;
  updatedAt?: string;
}

export interface CreateBucketInput {
  name: string;
  isPublic: boolean;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

export async function getBuckets(projectId: string): Promise<Bucket[]> {
  return apiRequest<Bucket[]>(`/api/storage/${projectId}/buckets`);
}

export async function createBucket(projectId: string, input: CreateBucketInput): Promise<Bucket> {
  return apiRequest<Bucket>(`/api/storage/${projectId}/buckets`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteBucket(id: string): Promise<void> {
  await apiRequest(`/api/storage/buckets/${id}`, { method: 'DELETE' });
}

export async function getFiles(bucketId: string, prefix?: string): Promise<StorageFile[]> {
  const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  return apiRequest<StorageFile[]>(`/api/storage/buckets/${bucketId}/files${query}`);
}

export async function uploadFile(bucketId: string, file: File, isPublic: boolean): Promise<StorageFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isPublic', String(isPublic));

  const token = typeof window !== 'undefined' ? localStorage.getItem('vrixo_access_token') : null;
  const res = await fetch(`${getApiBaseUrl()}/api/storage/buckets/${bucketId}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Upload failed');
  }
  return res.json();
}

export async function deleteFile(id: string): Promise<void> {
  await apiRequest(`/api/storage/files/${id}`, { method: 'DELETE' });
}

export async function getSignedUrl(fileId: string, expiresIn: number = 3600): Promise<{ url: string; expiresIn: number }> {
  return apiRequest<{ url: string; expiresIn: number }>(`/api/storage/files/${fileId}/signed-url?expiresIn=${expiresIn}`);
}

export async function getPublicUrl(fileId: string): Promise<{ url: string }> {
  return apiRequest<{ url: string }>(`/api/storage/files/${fileId}/public-url`);
}

export async function createFolder(bucketId: string, path: string): Promise<void> {
  await apiRequest(`/api/storage/buckets/${bucketId}/folders`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}
