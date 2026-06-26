'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Code,
  AlertCircle,
} from 'lucide-react';

export const DATA_TYPES = [
  { value: 'text', label: 'Text', category: 'String' },
  { value: 'varchar', label: 'Varchar(n)', category: 'String' },
  { value: 'char', label: 'Char(n)', category: 'String' },
  { value: 'integer', label: 'Integer', category: 'Numeric' },
  { value: 'bigint', label: 'Big Integer', category: 'Numeric' },
  { value: 'smallint', label: 'Small Integer', category: 'Numeric' },
  { value: 'decimal', label: 'Decimal', category: 'Numeric' },
  { value: 'real', label: 'Real', category: 'Numeric' },
  { value: 'double', label: 'Double Precision', category: 'Numeric' },
  { value: 'boolean', label: 'Boolean', category: 'Logical' },
  { value: 'date', label: 'Date', category: 'Date/Time' },
  { value: 'timestamp', label: 'Timestamp', category: 'Date/Time' },
  { value: 'timestamptz', label: 'Timestamp with TZ', category: 'Date/Time' },
  { value: 'time', label: 'Time', category: 'Date/Time' },
  { value: 'uuid', label: 'UUID', category: 'Other' },
  { value: 'json', label: 'JSON', category: 'Other' },
  { value: 'jsonb', label: 'JSONB', category: 'Other' },
  { value: 'bytea', label: 'Bytea (Binary)', category: 'Other' },
  { value: 'inet', label: 'INET', category: 'Other' },
  { value: 'macaddr', label: 'MAC Address', category: 'Other' },
];

interface ColumnDef {
  id: string;
  name: string;
  type: string;
  default: string;
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  foreignTable: string;
  foreignColumn: string;
}

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string;
    schema: string;
    columns: ColumnDef[];
  }) => void;
  loading?: boolean;
  existingTables?: string[];
}

const emptyColumn = (): ColumnDef => ({
  id: crypto.randomUUID?.() ?? Math.random().toString(36),
  name: '',
  type: 'text',
  default: '',
  nullable: false,
  unique: false,
  primaryKey: false,
  foreignTable: '',
  foreignColumn: '',
});

export function CreateTableDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  existingTables = [],
}: CreateTableDialogProps) {
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState('public');
  const [columns, setColumns] = useState<ColumnDef[]>([emptyColumn()]);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setTableName('');
    setDescription('');
    setSchema('public');
    setColumns([emptyColumn()]);
    setErrors({});
    setShowSqlPreview(false);
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, emptyColumn()]);
  };

  const removeColumn = (id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const updateColumn = (id: string, field: keyof ColumnDef, value: unknown) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!tableName.trim()) errs.name = 'Table name is required';
    else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName.trim()))
      errs.name = 'Invalid table name format';

    const validColumns = columns.filter((c) => c.name.trim());
    if (validColumns.length === 0) errs.columns = 'At least one column is required';

    const names = validColumns.map((c) => c.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) errs.duplicate = 'Column names must be unique';

    for (const col of validColumns) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name.trim()))
        errs[`col_${col.id}`] = `Invalid column name: ${col.name}`;
      if (col.foreignTable && !col.foreignColumn)
        errs[`fk_${col.id}`] = 'Foreign key requires both table and column';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const generateSQL = useMemo(() => {
    const validCols = columns.filter((c) => c.name.trim());
    if (!tableName.trim() || validCols.length === 0) return '';

    const lines: string[] = [];
    lines.push(`CREATE TABLE "${schema}"."${tableName.trim()}" (`);
    const colDefs = validCols.map((c) => {
      let def = `  "${c.name.trim()}" ${c.type.toUpperCase()}`;
      if (c.primaryKey) def += ' PRIMARY KEY';
      if (c.unique) def += ' UNIQUE';
      if (!c.nullable) def += ' NOT NULL';
      if (c.default) def += ` DEFAULT ${c.default}`;
      if (c.foreignTable && c.foreignColumn)
        def += ` REFERENCES "${c.foreignTable}"("${c.foreignColumn}")`;
      return def;
    });
    lines.push(colDefs.join(',\n'));
    lines.push(');');
    if (description.trim()) {
      lines.push(
        `COMMENT ON TABLE "${schema}"."${tableName.trim()}" IS '${description.replace(/'/g, "''")}';`,
      );
    }
    return lines.join('\n');
  }, [schema, tableName, columns, description]);

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ name: tableName.trim(), description, schema, columns });
    resetForm();
  };

  const categories = [...new Set(DATA_TYPES.map((d) => d.category))];

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            Create Table
          </DialogTitle>
          <DialogDescription>
            Add a new table to your database schema
          </DialogDescription>
        </DialogHeader>

        {errors.duplicate && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.duplicate}
          </div>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="table-name" className="text-xs">Table name</Label>
                <Input
                  id="table-name"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. users, posts"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schema" className="text-xs">Schema</Label>
                <Input
                  id="schema"
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                  placeholder="public"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs">Description (optional)</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this table"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Columns ({columns.filter((c) => c.name.trim()).length})</Label>
              <Button variant="outline" size="sm" onClick={addColumn} className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Column
              </Button>
            </div>

            {errors.columns && (
              <p className="text-xs text-destructive">{errors.columns}</p>
            )}

            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div
                  key={col.id}
                  className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/30" />
                      <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                    </div>
                    {columns.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeColumn(col.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Name</Label>
                      <Input
                        value={col.name}
                        onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                        placeholder="column_name"
                        className={`h-8 text-xs ${errors[`col_${col.id}`] ? 'border-destructive' : ''}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Type</Label>
                      <Select
                        value={col.type}
                        onValueChange={(v) => updateColumn(col.id, 'type', v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <div key={cat}>
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {cat}
                              </div>
                              {DATA_TYPES.filter((d) => d.category === cat).map((d) => (
                                <SelectItem key={d.value} value={d.value} className="text-xs">
                                  {d.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Default</Label>
                      <Input
                        value={col.default}
                        onChange={(e) => updateColumn(col.id, 'default', e.target.value)}
                        placeholder="NULL"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">FK Table</Label>
                      <Select
                        value={col.foreignTable}
                        onValueChange={(v) => updateColumn(col.id, 'foreignTable', v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {existingTables.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {col.foreignTable && (
                    <div className="pl-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">FK Column</Label>
                          <Input
                            value={col.foreignColumn}
                            onChange={(e) => updateColumn(col.id, 'foreignColumn', e.target.value)}
                            placeholder="id"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div />
                        <div />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={col.primaryKey}
                        onCheckedChange={(c) => updateColumn(col.id, 'primaryKey', !!c)}
                      />
                      <span className="text-xs text-muted-foreground">Primary Key</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={col.unique}
                        onCheckedChange={(c) => updateColumn(col.id, 'unique', !!c)}
                      />
                      <span className="text-xs text-muted-foreground">Unique</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={!col.nullable}
                        onCheckedChange={(c) => updateColumn(col.id, 'nullable', !c)}
                      />
                      <span className="text-xs text-muted-foreground">Not Null</span>
                    </label>
                  </div>
                  {errors[`fk_${col.id}`] && (
                    <p className="text-xs text-destructive">{errors[`fk_${col.id}`]}</p>
                  )}
                </div>
              ))}
            </div>

            <div>
              <button
                onClick={() => setShowSqlPreview((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showSqlPreview ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Code className="h-3 w-3" /> SQL Preview
              </button>
              {showSqlPreview && generateSQL && (
                <pre className="mt-2 rounded-lg bg-black/40 border border-border/50 p-3 text-xs font-mono text-green-400 overflow-x-auto">
                  {generateSQL}
                </pre>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            Create Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTableDialog;
