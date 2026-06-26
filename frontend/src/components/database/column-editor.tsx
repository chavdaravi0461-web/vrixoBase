'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, Save, RotateCcw } from 'lucide-react';
import { DATA_TYPES } from './create-table-dialog';

interface ColumnEditorProps {
  column: {
    name: string;
    type: string;
    default: string | null;
    nullable: boolean;
    unique: boolean;
    primary_key: boolean;
    foreign_key?: { table: string; column: string } | null;
  };
  existingTables?: string[];
  onSave: (data: {
    name: string;
    type: string;
    default: string | null;
    nullable: boolean;
    unique: boolean;
    primary_key: boolean;
  }) => void;
  onCancel: () => void;
}

export function ColumnEditor({ column, existingTables = [], onSave, onCancel }: ColumnEditorProps) {
  const [name, setName] = useState(column.name);
  const [type, setType] = useState(column.type);
  const [defaultVal, setDefaultVal] = useState(column.default ?? '');
  const [nullable, setNullable] = useState(column.nullable);
  const [unique, setUnique] = useState(column.unique);

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Edit Column
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              onSave({
                name,
                type,
                default: defaultVal || null,
                nullable,
                unique,
                primary_key: column.primary_key,
              })
            }
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Default</Label>
          <Input
            value={defaultVal}
            onChange={(e) => setDefaultVal(e.target.value)}
            placeholder="NULL"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={!nullable}
            onCheckedChange={(c) => setNullable(!c)}
          />
          <span className="text-xs text-muted-foreground">Not Null</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={unique}
            onCheckedChange={(c) => setUnique(!!c)}
          />
          <span className="text-xs text-muted-foreground">Unique</span>
        </label>
      </div>
    </div>
  );
}

export default ColumnEditor;
