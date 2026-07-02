'use client';

import { useState } from 'react';
import {
  Table2,
  ChevronRight,
  ChevronDown,
  Key,
  ArrowRight,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSchema } from '@/hooks/use-database';
import type { ColumnInfo, SchemaVisualization } from '@/lib/api/database';

interface SchemaExplorerProps {
  projectId: string;
  onInsertText: (text: string) => void;
}

export function SchemaExplorer({ projectId, onInsertText }: SchemaExplorerProps) {
  const { data: schema, isLoading, error, refetch } = useSchema(projectId);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredSchema = schema?.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const typeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('int') || t.includes('serial')) return 'text-amber-400';
    if (t.includes('char') || t.includes('text')) return 'text-sky-400';
    if (t.includes('bool')) return 'text-emerald-400';
    if (t.includes('time') || t.includes('date')) return 'text-violet-400';
    if (t.includes('json') || t.includes('uuid')) return 'text-rose-400';
    return 'text-muted-foreground';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mb-2" />
        <span className="text-xs">Loading schema...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="h-5 w-5 text-destructive mb-2" />
        <span className="text-xs text-destructive mb-2">Failed to load schema</span>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Find table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!filteredSchema || filteredSchema.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-3 text-center">
            <Table2 className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              {search ? 'No tables match your search' : 'No tables found'}
            </p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {filteredSchema.map((table) => {
              const isExpanded = expandedTables.has(table.name);
              const pkColumns = table.columns
                .filter((c) => c.isPrimary)
                .map((c) => c.name);

              return (
                <div key={table.name}>
                  <button
                    onClick={() => toggleTable(table.name)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 transition-colors text-left group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <Table2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-medium truncate flex-1">{table.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertText(table.name);
                      }}
                      title="Insert table name"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-4 font-normal cursor-pointer hover:bg-primary/20"
                      >
                        insert
                      </Badge>
                    </button>
                  </button>

                  {isExpanded && (
                    <div className="ml-4 space-y-px">
                      {table.columns.map((col) => (
                        <button
                          key={col.name}
                          onClick={() =>
                            onInsertText(`${table.name}.${col.name}`)
                          }
                          title="Insert column reference"
                          className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-left group"
                        >
                          {col.isPrimary ? (
                            <Key className="h-3 w-3 shrink-0 text-amber-400" />
                          ) : (
                            <span className="w-3 shrink-0" />
                          )}
                          <span className="truncate flex-1">{col.name}</span>
                          <div className="flex items-center gap-1">
                            {col.foreign_key && (
                              <ArrowRight className="h-2.5 w-2.5 text-violet-400 shrink-0" />
                            )}
                            <span className={cn('font-mono', typeColor(col.type))}>
                              {col.type}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
