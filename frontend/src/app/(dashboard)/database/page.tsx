'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CreateTableDialog } from '@/components/database/create-table-dialog';
import { SchemaVisualizer } from '@/components/database/schema-visualizer';
import { useTables, useCreateTable, useDeleteTable } from '@/hooks/use-database';
import { useProjectStore } from '@/stores/project-store';
import {
  Plus,
  Search,
  LayoutGrid,
  GitBranch,
  Table2,
  Database,
  HardDrive,
  BarChart3,
  Trash2,
  ChevronRight,
  Layers,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function DatabasePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const projectId = useProjectStore((s) => s.currentProject?.id);

  const { data: tables, isLoading, error, refetch } = useTables(projectId ?? '');
  const createTable = useCreateTable(projectId ?? '');
  const deleteTable = useDeleteTable(projectId ?? '');

  const filteredTables = useMemo(
    () =>
      tables?.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(search.toLowerCase()),
      ) ?? [],
    [tables, search],
  );

  const stats = useMemo(() => {
    if (!tables) return null;
    const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
    return { totalTables: tables.length, totalRows, tables };
  }, [tables]);

  const handleCreateTable = useCallback(
    (data: { name: string; description: string; schema: string; columns: any[] }) => {
      createTable.mutate(
        {
          name: data.name,
          description: data.description,
          columns: data.columns.map((c) => ({
            name: c.name,
            type: c.type,
            defaultValue: c.default || null,
            isNullable: c.nullable,
            isUnique: c.unique,
            isPrimary: c.primaryKey,
            foreign_key:
              c.foreignTable && c.foreignColumn
                ? { table: c.foreignTable, column: c.foreignColumn }
                : undefined,
          })),
        },
        {
          onSuccess: () => {
            toast.success(`Table "${data.name}" created`);
            setShowCreateDialog(false);
          },
          onError: (err) => {
            toast.error(err.message);
          },
        },
      );
    },
    [createTable],
  );

  const handleDeleteTable = useCallback(
    (tableName: string) => {
      if (!confirm(`Delete table "${tableName}"? This action cannot be undone.`)) return;
      deleteTable.mutate(tableName, {
        onSuccess: () => toast.success(`Table "${tableName}" deleted`),
        onError: (err) => toast.error(err.message),
      });
    },
    [deleteTable],
  );

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Database</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your database tables, schema, and data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-muted/30">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'graph'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <GitBranch className="h-3.5 w-3.5" /> Graph
            </button>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create Table
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Table2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTables}</p>
                  <p className="text-xs text-muted-foreground">Total Tables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Database className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalRows.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.tables.reduce((acc, t) => acc + (t as any).columns?.length || 0, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Columns</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <BarChart3 className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Database Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error.message}</span>
          <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {viewMode === 'graph' ? (
        <Card className="flex-1">
          <CardContent className="p-4">
            <SchemaVisualizer
              tables={
                filteredTables.map((t) => ({
                  name: t.name,
                  columns: [],
                  row_count: t.rowCount,
                })) ?? []
              }
              onTableClick={(name) => router.push(`/database/tables/${name}`)}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  {search ? (
                    <Search className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <Database className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? 'No tables match your search' : 'No tables yet'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {search
                    ? 'Try a different search term'
                    : 'Create your first table to get started'}
                </p>
                {!search && (
                  <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-1.5" /> Create Table
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {filteredTables.map((table) => (
                <Card
                  key={table.name}
                  className="cursor-pointer hover:border-border transition-all duration-200 group"
                  onClick={() => router.push(`/database/tables/${table.name}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                          <Table2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{table.name}</span>
                            {table.description && (
                              <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[200px]">
                                — {table.description}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Database className="h-3 w-3" />
                              {table.rowCount.toLocaleString()} rows
                            </span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Layers className="h-3 w-3" />
                              {(table as any).columns?.length || 0} columns
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(table.name);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <CreateTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateTable}
        loading={createTable.isPending}
        existingTables={tables?.map((t) => t.name) ?? []}
      />
    </div>
  );
}
