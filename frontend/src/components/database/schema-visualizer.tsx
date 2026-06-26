'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LayoutGrid, GitBranch, Maximize2, Minimize2, Search, Table2, Eye, EyeOff } from 'lucide-react';

interface ColumnInfo {
  name: string;
  type: string;
  primary_key?: boolean;
  foreign_key?: { table: string; column: string } | null;
}

interface TableNode {
  name: string;
  columns: ColumnInfo[];
  row_count?: number;
}

interface SchemaVisualizerProps {
  tables: TableNode[];
  onTableClick?: (tableName: string) => void;
  className?: string;
}

function TableBox({
  table,
  selected,
  onClick,
  compact,
}: {
  table: TableNode;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card/80 backdrop-blur-sm cursor-pointer transition-all duration-200',
        selected
          ? 'border-primary/50 shadow-glow'
          : 'border-border/50 hover:border-border hover:shadow-sm',
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-semibold truncate">{table.name}</span>
        </div>
        {table.row_count != null && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 ml-2">
            {table.row_count}
          </Badge>
        )}
      </div>
      <div className="p-1.5 space-y-0.5">
        {table.columns.slice(0, compact ? 5 : table.columns.length).map((col) => (
          <div
            key={col.name}
            className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-accent/5 text-[11px]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {col.primary_key && (
                <span className="text-amber-400 shrink-0" title="Primary Key">PK</span>
              )}
              {col.foreign_key && (
                <span className="text-blue-400 shrink-0" title="Foreign Key">FK</span>
              )}
              <span className="font-medium truncate">{col.name}</span>
            </div>
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 ml-2 font-mono">
              {col.type}
            </Badge>
          </div>
        ))}
        {compact && table.columns.length > 5 && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">
            +{table.columns.length - 5} more
          </div>
        )}
      </div>
    </div>
  );
}

export function SchemaVisualizer({
  tables,
  onTableClick,
  className,
}: SchemaVisualizerProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTables = useMemo(
    () =>
      search
        ? tables.filter((t) =>
            t.name.toLowerCase().includes(search.toLowerCase()),
          )
        : tables,
    [tables, search],
  );

  if (tables.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <div className="rounded-full bg-muted p-4 mb-4">
          <LayoutGrid className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No tables in schema</p>
        <p className="text-xs text-muted-foreground/60">Create a table to see the schema visualization</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tables..."
            className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCompact((v) => !v)}
        >
          {compact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="h-[500px]">
        <div
          className={cn(
            'gap-3',
            compact
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {filteredTables.map((table) => (
            <TableBox
              key={table.name}
              table={table}
              selected={selectedTable === table.name}
              compact={compact}
              onClick={() => {
                setSelectedTable(table.name);
                onTableClick?.(table.name);
              }}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filteredTables.length} of {tables.length} table{tables.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">PK</span> Primary Key
          </span>
          <span className="flex items-center gap-1">
            <span className="text-blue-400 font-bold">FK</span> Foreign Key
          </span>
        </div>
      </div>
    </div>
  );
}

export default SchemaVisualizer;
