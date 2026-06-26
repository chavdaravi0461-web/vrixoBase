import { apiRequest } from './client';

export interface ApiKey {
  id: string;
  name: string;
  type: 'PUBLIC' | 'SECRET';
  key: string;
  lastUsedAt: string | null;
  createdAt: string;
  revoked?: boolean;
}

export interface CreateApiKeyInput {
  name: string;
  type?: 'PUBLIC' | 'SECRET';
}

export async function getApiKeys(projectId: string): Promise<ApiKey[]> {
  return apiRequest<ApiKey[]>(`/api/api-keys/${projectId}`);
}

export async function createApiKey(projectId: string, input: CreateApiKeyInput): Promise<ApiKey & { rawKey: string }> {
  return apiRequest<ApiKey & { rawKey: string }>(`/api/api-keys/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function revokeApiKey(projectId: string, id: string): Promise<void> {
  await apiRequest(`/api/api-keys/${projectId}/${id}`, { method: 'DELETE' });
}


