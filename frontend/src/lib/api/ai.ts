import { apiRequest } from './client';

export interface SqlResult {
  sql: string;
  explanation: string;
  tokensUsed?: number;
  model?: string;
}

export interface AiSuggestion {
  id: string;
  sql: string;
  explanation: string;
  category: string;
  tokensUsed?: number;
  model?: string;
}

export async function nlToSql(projectId: string, prompt: string): Promise<SqlResult> {
  return apiRequest<SqlResult>(`/api/ai/${projectId}/nl-to-sql`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export async function explainSql(projectId: string, sql: string, context?: string): Promise<{ explanation: string }> {
  return apiRequest<{ explanation: string }>(`/api/ai/${projectId}/explain-sql`, {
    method: 'POST',
    body: JSON.stringify({ sql, context }),
  });
}

export async function generateSchema(projectId: string, description: string): Promise<SqlResult> {
  return apiRequest<SqlResult>(`/api/ai/${projectId}/generate-schema`, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}
