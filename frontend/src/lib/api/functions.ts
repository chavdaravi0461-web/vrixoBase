import { apiRequest } from './client';

export interface FunctionItem {
  id: string;
  name: string;
  slug: string;
  runtime: string;
  status: string;
  timeout: number;
  memory: number;
  createdAt: string;
  source: string;
  entryPoint: string;
  lastExecutedAt: string | null;
  executionCount: number;
  environmentVariables: Record<string, string>;
  webhookUrl: string | null;
  updatedAt: string;
}

export interface CreateFunctionInput {
  name: string;
  slug?: string;
  description?: string;
  sourceCode: string;
  runtime?: string;
  handler?: string;
  timeout?: number;
  memory?: number;
}

export interface ExecutionRecord {
  id: string;
  functionId: string;
  status: string;
  duration: number | null;
  logs: string | null;
  output: string | null;
  error: string | null;
  triggeredAt: string;
  input?: string;
  [key: string]: unknown;
}

export interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export async function getFunctions(projectId: string): Promise<FunctionItem[]> {
  return apiRequest<FunctionItem[]>(`/api/functions/${projectId}`);
}

export async function createFunction(projectId: string, input: CreateFunctionInput): Promise<FunctionItem> {
  return apiRequest<FunctionItem>(`/api/functions/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getFunction(projectId: string, id: string): Promise<FunctionItem> {
  return apiRequest<FunctionItem>(`/api/functions/${projectId}/${id}`);
}

export async function updateFunction(projectId: string, id: string, input: Partial<CreateFunctionInput>): Promise<FunctionItem> {
  return apiRequest<FunctionItem>(`/api/functions/${projectId}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteFunction(projectId: string, id: string): Promise<void> {
  await apiRequest(`/api/functions/${projectId}/${id}`, { method: 'DELETE' });
}

export async function executeFunction(projectId: string, id: string, payload?: any): Promise<any> {
  return apiRequest(`/api/functions/${projectId}/${id}/execute`, {
    method: 'POST',
    body: JSON.stringify({ payload }),
  });
}

export async function getExecutionLogs(projectId: string, id: string): Promise<ExecutionRecord[]> {
  return apiRequest<ExecutionRecord[]>(`/api/functions/${projectId}/${id}/executions`);
}

export async function getWebhooks(projectId: string): Promise<WebhookItem[]> {
  return apiRequest<WebhookItem[]>(`/api/functions/${projectId}/webhooks`);
}

export async function createWebhook(projectId: string, input: { name: string; url: string; events: string[]; functionId?: string }): Promise<WebhookItem> {
  return apiRequest<WebhookItem>(`/api/functions/${projectId}/webhooks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteWebhook(projectId: string, id: string): Promise<void> {
  await apiRequest(`/api/functions/webhooks/${id}`, { method: 'DELETE' });
}
