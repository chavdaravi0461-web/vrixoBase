import { apiRequest } from './client';

export interface Policy {
  id: string;
  name: string;
  tableName: string;
  definition: string;
  roles: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyInput {
  name: string;
  tableName: string;
  definition: string;
  roles?: string[];
}

export interface Secret {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSecretInput {
  name: string;
  value: string;
  type?: string;
}

export async function getPolicies(projectId: string, tableName?: string): Promise<Policy[]> {
  const query = tableName ? `?tableName=${encodeURIComponent(tableName)}` : '';
  return apiRequest<Policy[]>(`/api/security/${projectId}/policies${query}`);
}

export async function createPolicy(projectId: string, input: CreatePolicyInput): Promise<Policy> {
  return apiRequest<Policy>(`/api/security/${projectId}/policies`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deletePolicy(id: string): Promise<void> {
  await apiRequest(`/api/security/policies/${id}`, { method: 'DELETE' });
}

export async function getSecrets(projectId: string): Promise<Secret[]> {
  return apiRequest<Secret[]>(`/api/security/${projectId}/secrets`);
}

export async function createSecret(projectId: string, input: CreateSecretInput): Promise<{ id: string; name: string; type: string; createdAt: string }> {
  return apiRequest(`/api/security/${projectId}/secrets`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteSecret(projectId: string, id: string): Promise<void> {
  await apiRequest(`/api/security/${projectId}/secrets/${id}`, { method: 'DELETE' });
}
