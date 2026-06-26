import { apiRequest } from './client';

export interface ColumnInfo {
  name: string;
  type: string;
  defaultValue: string | null;
  isNullable: boolean;
  isUnique: boolean;
  isPrimary: boolean;
  ordinalPosition: number;
  foreign_key?: { table: string; column: string } | null;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  description: string | null;
}

export interface TableDetail {
  name: string;
  description: string | null;
  schema: string;
  rowCount: number;
  size: string;
  columns: ColumnInfo[];
  policies: PolicyInfo[];
  relationships: RelationshipInfo[];
}

export interface PolicyInfo {
  id: string;
  name: string;
  command: string;
  roles: string[];
  enabled: boolean;
  using?: string;
  check?: string;
}

export interface RelationshipInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  defaultValue?: any;
  isNullable?: boolean;
  isUnique?: boolean;
  isPrimary?: boolean;
}

export interface QueryResultColumn {
  name: string;
  type: string;
}

export interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  columns: QueryResultColumn[];
  duration_ms: number;
}

export interface SchemaVisualization {
  name: string;
  description: string | null;
  columns: ColumnInfo[];
  relations: Array<{ columnName: string; referencedTable: string; referencedColumn: string }>;
}

export async function getTables(projectId: string): Promise<TableInfo[]> {
  return apiRequest<TableInfo[]>(`/api/database/${projectId}/tables`);
}

export async function getTable(projectId: string, tableName: string): Promise<TableDetail> {
  return apiRequest<TableDetail>(`/api/database/${projectId}/tables/${encodeURIComponent(tableName)}`);
}

export async function createTable(projectId: string, data: { name: string; description?: string; columns: ColumnDefinition[] }): Promise<TableDetail> {
  return apiRequest<TableDetail>(`/api/database/${projectId}/tables`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTable(projectId: string, tableName: string): Promise<void> {
  await apiRequest(`/api/database/${projectId}/tables/${encodeURIComponent(tableName)}`, { method: 'DELETE' });
}

export async function addColumn(projectId: string, tableName: string, data: ColumnDefinition): Promise<TableDetail> {
  return apiRequest<TableDetail>(`/api/database/${projectId}/tables/${encodeURIComponent(tableName)}/columns`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteColumn(projectId: string, tableName: string, columnName: string): Promise<void> {
  await apiRequest(`/api/database/${projectId}/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}`, { method: 'DELETE' });
}

export async function updateColumn(projectId: string, tableName: string, columnName: string, data: Partial<ColumnDefinition>): Promise<TableDetail> {
  return apiRequest<TableDetail>(`/api/database/${projectId}/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function executeQuery(projectId: string, query: string): Promise<QueryResult> {
  return apiRequest<QueryResult>(`/api/database/${projectId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function getQueryHistory(projectId: string): Promise<any[]> {
  return apiRequest<any[]>(`/api/database/${projectId}/query-history`);
}

export async function getPerformance(projectId: string): Promise<any> {
  return apiRequest<any>(`/api/database/${projectId}/performance`);
}

export async function getSchema(projectId: string): Promise<SchemaVisualization[]> {
  return apiRequest<SchemaVisualization[]>(`/api/database/${projectId}/schema`);
}
