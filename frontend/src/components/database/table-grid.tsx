'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash2, Copy, ArrowLeftRight,
  Eye, EyeOff, Columns,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  type?: string;
  width?: number;
  sortable?: boolean;
  editable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface TableGridProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  loading?: boolean;
  emptyMessage?: string;
  error?: string | null;
  onRowClick?: (row: T) => void;
  onCellEdit?: (rowIndex: number, columnKey: string, value: unknown) => void;
  onDeleteRow?: (row: T) => void;
  onDuplicateRow?: (row: T) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  selectable?: boolean;
  onSelectionChange?: (selected: Set<number>) => void;
  onRefresh?: () => void;
}

const ROW_HEIGHT = 44;

function TableGrid<T extends Record<string, unknown>>({
  columns: allColumns,
  data,
  keyField = 'id',
  loading = false,
  emptyMessage = 'No data',
  error = null,
  onRowClick,
  onCellEdit,
  onDeleteRow,
  onDuplicateRow,
  pageSize: defaultPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  selectable = false,
  onSelectionChange,
  onRefresh,
}: TableGridProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(allColumns.map((c) => c.key)),
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingColumn = useRef<string | null>(null);
  const resizeStart = useRef<{ x: number; width: number }>({ x: 0, width: 0 });

  const visibleColumnDefs = useMemo(
    () => allColumns.filter((c) => visibleColumns.has(c.key)),
    [allColumns, visibleColumns],
  );

  const sortedData = useMemo(() => {
    let filtered = data;
    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = data.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? '').toLowerCase().includes(lower),
        ),
      );
    }
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = aVal == null ? -1 : bVal == null ? 1 : aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, filterText]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = useMemo(
    () => sortedData.slice(page * pageSize, (page + 1) * pageSize),
    [sortedData, page, pageSize],
  );

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    const next = checked ? new Set(pagedData.map((_, i) => page * pageSize + i)) : new Set<number>();
    setSelectedRows(next);
    onSelectionChange?.(next);
  };

  const handleSelectRow = (idx: number, checked: boolean) => {
    const globalIdx = page * pageSize + idx;
    const next = new Set(selectedRows);
    checked ? next.add(globalIdx) : next.delete(globalIdx);
    setSelectedRows(next);
    onSelectionChange?.(next);
  };

  const startEdit = (rowIdx: number, colKey: string, value: unknown) => {
    setEditingCell({ row: rowIdx, col: colKey });
    setEditValue(String(value ?? ''));
  };

  const commitEdit = useCallback(() => {
    if (editingCell && onCellEdit) {
      onCellEdit(editingCell.row, editingCell.col, editValue);
    }
    setEditingCell(null);
  }, [editingCell, editValue, onCellEdit]);

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    resizingColumn.current = colKey;
    resizeStart.current = { x: e.clientX, width: columnWidths[colKey] || 150 };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const diff = e.clientX - resizeStart.current.x;
    setColumnWidths((prev) => ({
      ...prev,
      [resizingColumn.current!]: Math.max(60, resizeStart.current.width + diff),
    }));
  };

  const handleResizeEnd = () => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Trash2 className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm text-destructive font-medium mb-1">Failed to load data</p>
        <p className="text-xs text-muted-foreground mb-4">{error}</p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>Try again</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Filter rows..."
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(0);
            }}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowColumnMenu((v) => !v)}
                  >
                    <Columns className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle columns</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl p-2 shadow-md">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Columns</p>
                {allColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent/10 cursor-pointer"
                  >
                    <Checkbox
                      checked={visibleColumns.has(col.key)}
                      onCheckedChange={(checked) => {
                        const next = new Set(visibleColumns);
                        checked ? next.add(col.key) : next.delete(col.key);
                        setVisibleColumns(next);
                      }}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedRows.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedRows.size} selected
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      pagedData.length > 0 && selectedRows.size === page * pageSize + pagedData.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {visibleColumnDefs.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'relative text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  style={{ width: columnWidths[col.key] || col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.sortable !== false && (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </button>
                    )}
                    {col.sortable === false && <span>{col.label}</span>}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group"
                      onMouseDown={(e) => handleResizeStart(e, col.key)}
                    >
                      <div className="w-px h-full bg-border/50 group-hover:bg-primary/50 transition-colors mx-auto" />
                    </div>
                  </div>
                </TableHead>
              ))}
              {(onDeleteRow || onDuplicateRow) && (
                <TableHead className="w-20 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {selectable && (
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                  )}
                  {visibleColumnDefs.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                  {(onDeleteRow || onDuplicateRow) && (
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  )}
                </TableRow>
              ))
            ) : pagedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    (selectable ? 1 : 0) + visibleColumnDefs.length + ((onDeleteRow || onDuplicateRow) ? 1 : 0)
                  }
                  className="h-64 text-center"
                >
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="rounded-full bg-muted p-3 mb-3">
                      <EyeOff className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {filterText && (
                      <p className="text-xs mt-1">Try adjusting your filter</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((row, rowIdx) => {
                const globalIdx = page * pageSize + rowIdx;
                const isSelected = selectedRows.has(globalIdx);
                return (
                  <TableRow
                    key={(row as any)[keyField] ?? globalIdx}
                    className={cn(
                      'transition-colors',
                      isSelected && 'bg-primary/5',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={() => onRowClick?.(row)}
                    data-state={isSelected ? 'selected' : undefined}
                  >
                    {selectable && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => handleSelectRow(rowIdx, !!c)}
                        />
                      </TableCell>
                    )}
                    {visibleColumnDefs.map((col) => {
                      const value = row[col.key];
                      const isEditing =
                        editingCell?.row === globalIdx && editingCell?.col === col.key;
                      return (
                        <TableCell
                          key={col.key}
                          className={cn(
                            'text-xs',
                            col.align === 'right' && 'text-right',
                            col.editable && 'cursor-pointer hover:bg-accent/5',
                          )}
                          style={{ height: ROW_HEIGHT }}
                          onClick={(e) => {
                            if (col.editable && onCellEdit) {
                              e.stopPropagation();
                              startEdit(globalIdx, col.key, value);
                            }
                          }}
                        >
                          {isEditing ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="h-7 text-xs"
                              autoFocus
                            />
                          ) : col.render ? (
                            col.render(value, row)
                          ) : (
                            <span className="truncate block max-w-[300px]">
                              {value == null ? (
                                <span className="text-muted-foreground italic">NULL</span>
                              ) : typeof value === 'boolean' ? (
                                <Badge variant={value ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                  {String(value)}
                                </Badge>
                              ) : (
                                String(value)
                              )}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    {(onDeleteRow || onDuplicateRow) && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {onDuplicateRow && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onDuplicateRow(row)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Duplicate</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {onDeleteRow && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => onDeleteRow(row)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page === 0}
            onClick={() => setPage(0)}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}

export { TableGrid };
export default TableGrid;
