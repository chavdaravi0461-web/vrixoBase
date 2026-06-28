export enum WalChangeType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface WalColumn {
  name: string;
  value: unknown;
  type: number;
}

export interface WalRelation {
  relationOid: number;
  schema: string;
  table: string;
  columns: WalColumn[];
}

export interface WalChangePayload {
  projectId: string;
  tableName: string;
  schema: string;
  eventType: WalChangeType;
  commitTimestamp: Date;
  newData: Record<string, unknown> | null;
  oldData: Record<string, unknown> | null;
  columns: string[];
}

export interface WalParsedMessage {
  changes: WalChangePayload[];
  xid: number;
  lsn: string;
}

export interface WALListenerOptions {
  connectionString: string;
  publicationName: string;
  slotName: string;
  plugin: 'pgoutput' | 'wal2json';
}
