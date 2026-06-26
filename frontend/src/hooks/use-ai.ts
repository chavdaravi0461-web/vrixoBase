'use client';

import { useMutation } from '@tanstack/react-query';
import * as api from '@/lib/api/ai';

export function useNlToSql(projectId: string) {
  return useMutation({
    mutationFn: (prompt: string) => api.nlToSql(projectId, prompt),
  });
}

export function useExplainSql(projectId: string) {
  return useMutation({
    mutationFn: ({ sql, context }: { sql: string; context?: string }) =>
      api.explainSql(projectId, sql, context),
  });
}

export function useGenerateSchema(projectId: string) {
  return useMutation({
    mutationFn: (description: string) => api.generateSchema(projectId, description),
  });
}
