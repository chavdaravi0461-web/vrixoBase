'use client';

import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Table2, AlertCircle, Clock, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/lib/api/database';

interface QueryResultsProps {
  result: QueryResult | null;
  loading?: boolean;
  error?: string | null;
}

function formatCellValue(value: unknown, type: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }
  switch (type.toLowerCase()) {
    case 'boolean':
      return (
        <Badge variant={value ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
          {String(value)}
        </Badge>
      );
    case 'json':
    case 'jsonb':
      return (
        <code className="text-xs text-amber-400">
          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </code>
      );
    case 'timestamp':
    case 'timestamptz':
    case 'date':
      return <span className="text-xs text-blue-400">{String(value)}</span>;
    default:
      return <span className="text-xs">{String(value)}</span>;
  }
}

function exportCSV(result: QueryResult) {
  const headers = result.columns.map((c) => c.name);
  const rows = result.rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }),
  );
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `query_results_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function QueryResults({ result, loading = false, error = null }: QueryResultsProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-destructive/20 bg-destructive/5">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <p className="text-sm font-medium text-destructive mb-1">Query Error</p>
        <p className="text-xs text-muted-foreground max-w-md">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-3 border-b border-border/30 bg-muted/20">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-border/50">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Database className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No results yet</p>
        <p className="text-xs text-muted-foreground/60">
          Write a query and click Run to see results here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Table2 className="h-3.5 w-3.5" />
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {result.duration_ms.toFixed(1)} ms
          </span>
          <span className="flex items-center gap-1">
            {result.columns.length} column{result.columns.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => exportCSV(result)}
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>
      <div className="overflow-auto max-h-[500px] scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {result.columns.map((col) => (
                <TableHead
                  key={col.name}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    {col.name}
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                      {col.type}
                    </Badge>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={result.columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Query executed successfully — 0 rows returned
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, idx) => (
                <TableRow
                  key={idx}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    expandedRow === idx && 'bg-muted/40',
                  )}
                  onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                >
                  {result.columns.map((col) => (
                    <TableCell
                      key={col.name}
                      className="text-xs max-w-[200px] truncate"
                    >
                      {formatCellValue(row[col.name], col.type)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default QueryResults;
