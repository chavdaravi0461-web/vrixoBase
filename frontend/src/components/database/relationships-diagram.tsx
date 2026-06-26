'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowRight,
  Link2,
  Table2,
  Key,
  Unlink,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ColumnInfo {
  name: string;
  type: string;
  primary_key?: boolean;
  foreign_key?: { table: string; column: string } | null;
}

interface Relationship {
  id: string;
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  update_rule: string;
  delete_rule: string;
}

interface RelationshipsDiagramProps {
  relationships: Relationship[];
  tables: {
    name: string;
    columns: ColumnInfo[];
  }[];
  className?: string;
}

const RULE_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' }> = {
  'NO ACTION': { label: 'No Action', variant: 'secondary' },
  'CASCADE': { label: 'Cascade', variant: 'destructive' },
  'SET NULL': { label: 'Set Null', variant: 'warning' },
  'SET DEFAULT': { label: 'Set Default', variant: 'outline' },
  'RESTRICT': { label: 'Restrict', variant: 'default' },
};

export function RelationshipsDiagram({
  relationships,
  tables,
  className,
}: RelationshipsDiagramProps) {
  const [search, setSearch] = useState('');
  const [selectedRel, setSelectedRel] = useState<string | null>(null);

  const tableMap = useMemo(
    () => new Map(tables.map((t) => [t.name, t])),
    [tables],
  );

  const filtered = useMemo(
    () =>
      search
        ? relationships.filter(
            (r) =>
              r.source_table.toLowerCase().includes(search.toLowerCase()) ||
              r.target_table.toLowerCase().includes(search.toLowerCase()) ||
              r.constraint_name.toLowerCase().includes(search.toLowerCase()),
          )
        : relationships,
    [relationships, search],
  );

  if (relationships.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <div className="rounded-full bg-muted p-4 mb-4">
          <Unlink className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No relationships found</p>
        <p className="text-xs text-muted-foreground/60">
          Foreign key constraints will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search relationships..."
          className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No relationships match your search
            </div>
          ) : (
            filtered.map((rel) => {
              const sourceTable = tableMap.get(rel.source_table);
              const targetTable = tableMap.get(rel.target_table);
              const rule = RULE_LABELS[rel.delete_rule] || { label: rel.delete_rule, variant: 'secondary' as const };

              return (
                <Card
                  key={rel.id}
                  className={cn(
                    'transition-all duration-200 cursor-pointer',
                    selectedRel === rel.id && 'ring-1 ring-primary/50',
                  )}
                  onClick={() => setSelectedRel(selectedRel === rel.id ? null : rel.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs font-medium">{rel.constraint_name}</span>
                      <Badge variant={rule.variant} className="text-[9px] px-1.5 py-0 ml-auto">
                        {rule.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Table2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold truncate">{rel.source_table}</span>
                          <span className="text-muted-foreground">.</span>
                          <span className="font-mono text-muted-foreground">{rel.source_column}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Table2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold truncate">{rel.target_table}</span>
                          <span className="text-muted-foreground">.</span>
                          <span className="font-mono text-muted-foreground">{rel.target_column}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{filtered.length} relationship{filtered.length !== 1 ? 's' : ''}</span>
        <Separator orientation="vertical" className="h-3" />
        <span className="flex items-center gap-1">
          Delete rule: <Badge variant="destructive" className="text-[9px] px-1 py-0">Cascade</Badge>
        </span>
      </div>
    </div>
  );
}

export default RelationshipsDiagram;
