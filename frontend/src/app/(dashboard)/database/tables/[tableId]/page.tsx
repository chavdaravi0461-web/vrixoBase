'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableGrid, type Column } from '@/components/database/table-grid';
import { ColumnEditor } from '@/components/database/column-editor';
import { RelationshipsDiagram } from '@/components/database/relationships-diagram';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useTable,
  useDeleteTable,
  useAddColumn,
  useDeleteColumn,
  useUpdateColumn,
} from '@/hooks/use-database';
import { useProjectStore } from '@/stores/project-store';
import { DATA_TYPES } from '@/components/database/create-table-dialog';
import {
  ArrowLeft,
  Table2,
  Database,
  Layers,
  HardDrive,
  Plus,
  Trash2,
  Pencil,
  Shield,
  Link2,
  AlertCircle,
  RefreshCw,
  Key,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function TableDetailPage() {
  const params = useParams<{ tableId: string }>();
  const router = useRouter();
  const tableName = decodeURIComponent(params.tableId);
  const projectId = useProjectStore((s) => s.currentProject?.id) ?? '';

  const { data: table, isLoading, error, refetch } = useTable(projectId, tableName);
  const deleteTable = useDeleteTable(projectId);
  const addColumn = useAddColumn(projectId, tableName);
  const deleteColumn = useDeleteColumn(projectId, tableName);
  const updateColumn = useUpdateColumn(projectId, tableName);

  const [activeTab, setActiveTab] = useState('browse');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState({
    name: '',
    type: 'text',
    default: '',
    nullable: false,
    unique: false,
    primary_key: false,
  });

  const handleDeleteTable = useCallback(() => {
    deleteTable.mutate(tableName, {
      onSuccess: () => {
        toast.success(`Table "${tableName}" deleted`);
        router.push('/database');
      },
      onError: (err) => toast.error(err.message),
    });
  }, [deleteTable, tableName, router]);

  const handleAddColumn = useCallback(() => {
    if (!newColumn.name.trim()) {
      toast.error('Column name is required');
      return;
    }
    addColumn.mutate(
      {
        name: newColumn.name.trim(),
        type: newColumn.type,
        defaultValue: newColumn.default || null,
        isNullable: newColumn.nullable,
        isUnique: newColumn.unique,
        isPrimary: newColumn.primary_key,
      },
      {
        onSuccess: () => {
          toast.success(`Column "${newColumn.name}" added`);
          setShowAddColumn(false);
          setNewColumn({ name: '', type: 'text', default: '', nullable: false, unique: false, primary_key: false });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }, [addColumn, newColumn]);

  const handleDeleteColumn = useCallback(() => {
    if (!columnToDelete) return;
    deleteColumn.mutate(columnToDelete, {
      onSuccess: () => {
        toast.success(`Column "${columnToDelete}" deleted`);
        setColumnToDelete(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }, [deleteColumn, columnToDelete]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-destructive mb-1">Failed to load table</p>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/database')}>
            Back to Database
          </Button>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !table) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-40 mb-1" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const browseColumns: Column[] = (table.columns || []).map((col) => ({
    key: col.name,
    label: col.name,
    type: col.type,
    sortable: true,
    editable: col.name !== 'id' && !col.isPrimary,
    render: (value) => {
      if (value == null) return <span className="text-muted-foreground italic">NULL</span>;
      if (col.type === 'boolean')
        return (
          <Badge variant={value ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
            {String(value)}
          </Badge>
        );
      if (['json', 'jsonb'].includes(col.type))
        return (
          <code className="text-xs text-amber-400">
            {typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : String(value).slice(0, 50)}
          </code>
        );
      return String(value).slice(0, 100);
    },
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/50 bg-card/30">
        <div className="p-4 sm:p-6">
          <button
            onClick={() => router.push('/database')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Database
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <Table2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{table.name}</h1>
                  {table.schema && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {table.schema}
                    </Badge>
                  )}
                </div>
                {table.description && (
                  <p className="text-sm text-muted-foreground mt-1">{table.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    {table.rowCount.toLocaleString()} rows
                  </span>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    {table.columns?.length || 0} columns
                  </span>
                  {table.size && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HardDrive className="h-3.5 w-3.5" />
                        {table.size}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete Table
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="mb-0">
            <TabsTrigger value="browse" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" /> Browse
            </TabsTrigger>
            <TabsTrigger value="structure" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Structure
            </TabsTrigger>
            <TabsTrigger value="relationships" className="text-xs gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Relationships
            </TabsTrigger>
            <TabsTrigger value="policies" className="text-xs gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Policies
              {(table.policies?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                  {table.policies.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="browse" className="mt-0">
            <TableGrid
              columns={browseColumns}
              data={[]}
              loading={false}
              emptyMessage="Browse data view — connect to your database to see rows"
              keyField="_row"
            />
          </TabsContent>

          <TabsContent value="structure" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Columns ({table.columns?.length || 0})</h3>
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowAddColumn(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Column
              </Button>
            </div>

            {table.columns?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No columns defined</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Add a column to define the table structure
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {table.columns.map((col) => (
                  <Card key={col.name} className="overflow-hidden">
                    <CardContent className="p-0">
                      {editingColumn === col.name ? (
                        <div className="p-3">
                          <ColumnEditor
                            column={{
                              name: col.name,
                              type: col.type,
                              default: col.defaultValue,
                              nullable: col.isNullable,
                              unique: col.isUnique,
                              primary_key: col.isPrimary,
                              foreign_key: col.foreign_key,
                            }}
                            onSave={(data) => {
                              updateColumn.mutate(
                                { columnName: col.name, data },
                                {
                                  onSuccess: () => {
                                    toast.success(`Column "${col.name}" updated`);
                                    setEditingColumn(null);
                                  },
                                  onError: (err) => toast.error(err.message),
                                },
                              );
                            }}
                            onCancel={() => setEditingColumn(null)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3 group">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {col.isPrimary && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Key className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent>Primary Key</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {col.foreign_key && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      FK → {col.foreign_key.table}.{col.foreign_key.column}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <span className="font-medium text-sm">{col.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                              {col.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {col.defaultValue != null && (
                              <span className="text-muted-foreground/60">
                                default: <span className="font-mono">{col.defaultValue}</span>
                              </span>
                            )}
                            <Badge
                              variant={col.isNullable ? 'secondary' : 'default'}
                              className="text-[9px] px-1.5 py-0"
                            >
                              {col.isNullable ? 'NULL' : 'NOT NULL'}
                            </Badge>
                            {col.isUnique && (
                              <Badge variant="success" className="text-[9px] px-1.5 py-0">
                                UNIQUE
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingColumn(col.name)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setColumnToDelete(col.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="relationships" className="mt-0">
            <RelationshipsDiagram
              relationships={(table.relationships || []).map((r) => ({
                id: `${r.columnName}-${r.referencedTable}-${r.referencedColumn}`,
                constraint_name: `${r.columnName}_fkey`,
                source_table: table.name,
                source_column: r.columnName,
                target_table: r.referencedTable,
                target_column: r.referencedColumn,
                update_rule: 'NO ACTION',
                delete_rule: 'NO ACTION',
              }))}
              tables={[
                {
                  name: table.name,
                  columns: table.columns || [],
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="policies" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Row Level Security Policies ({(table.policies || []).length})
              </h3>
              <Button size="sm" className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Policy
              </Button>
            </div>

            {(table.policies || []).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No RLS policies</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Row Level Security policies help secure your data
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {table.policies.map((policy) => (
                  <Card key={policy.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{policy.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {policy.command}
                          </Badge>
                        </div>
                        <Switch checked={policy.enabled} />
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span>Roles: {policy.roles?.join(', ') || 'public'}</span>
                      </div>
                      {policy.using && (
                        <pre className="mt-2 rounded-lg bg-black/30 border border-border/30 p-2 text-[11px] font-mono text-green-400 overflow-x-auto">
                          USING: {policy.using}
                        </pre>
                      )}
                      {policy.check && (
                        <pre className="mt-1 rounded-lg bg-black/30 border border-border/30 p-2 text-[11px] font-mono text-blue-400 overflow-x-auto">
                          CHECK: {policy.check}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete table &ldquo;{table.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data, indexes, and relationships relying on this table
              will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTable}
              disabled={deleteTable.isPending}
            >
              {deleteTable.isPending ? 'Deleting...' : 'Delete Table'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!columnToDelete} onOpenChange={() => setColumnToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete column &ldquo;{columnToDelete}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the column and all its data from the table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteColumn}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
            <DialogDescription>Add a new column to &ldquo;{table.name}&rdquo;</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Column Name</Label>
              <Input
                value={newColumn.name}
                onChange={(e) => setNewColumn((v) => ({ ...v, name: e.target.value }))}
                placeholder="column_name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={newColumn.type}
                onValueChange={(v) => setNewColumn((prev) => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default Value (optional)</Label>
              <Input
                value={newColumn.default}
                onChange={(e) => setNewColumn((v) => ({ ...v, default: e.target.value }))}
                placeholder="NULL"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={!newColumn.nullable}
                  onCheckedChange={(c) => setNewColumn((v) => ({ ...v, nullable: !c }))}
                />
                <span className="text-sm">Not Null</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={newColumn.unique}
                  onCheckedChange={(c) => setNewColumn((v) => ({ ...v, unique: !!c }))}
                />
                <span className="text-sm">Unique</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={newColumn.primary_key}
                  onCheckedChange={(c) => setNewColumn((v) => ({ ...v, primary_key: !!c }))}
                />
                <span className="text-sm">Primary Key</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddColumn(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn} disabled={addColumn.isPending}>
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
