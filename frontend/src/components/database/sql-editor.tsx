'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play, Sparkles } from 'lucide-react';

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'AND',
  'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'AS', 'ON', 'JOIN',
  'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'GROUP', 'BY',
  'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'WITH', 'RECURSIVE',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT',
  'CHECK', 'UNIQUE', 'INDEX', 'TRIGGER', 'FUNCTION', 'PROCEDURE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'RETURNING', 'EXPLAIN', 'ANALYZE',
  'CAST', 'COALESCE', 'NULLIF', 'TRUE', 'FALSE',
];

const SQL_TYPES = [
  'INTEGER', 'BIGINT', 'SMALLINT', 'TEXT', 'VARCHAR', 'CHAR',
  'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIME', 'UUID',
  'JSON', 'JSONB', 'DECIMAL', 'REAL', 'DOUBLE', 'BYTEA', 'SERIAL',
];

function tokenize(line: string): { text: string; type: string }[] {
  const tokens: { text: string; type: string }[] = [];
  const parts = line.split(/(\s+|'[^']*'|"[^"]*"|--.*|\/\*[\s\S]*?\*\/)/g);
  for (const part of parts) {
    if (!part) continue;
    if (/^'.*'$/.test(part) || /^".*"$/.test(part)) {
      tokens.push({ text: part, type: 'string' });
    } else if (/^--/.test(part)) {
      tokens.push({ text: part, type: 'comment' });
    } else if (SQL_KEYWORDS.includes(part.toUpperCase())) {
      tokens.push({ text: part, type: 'keyword' });
    } else if (SQL_TYPES.includes(part.toUpperCase())) {
      tokens.push({ text: part, type: 'type' });
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      tokens.push({ text: part, type: 'number' });
    } else {
      tokens.push({ text: part, type: 'plain' });
    }
  }
  return tokens;
}

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  readOnly?: boolean;
  minHeight?: number;
  placeholder?: string;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  readOnly = false,
  minHeight = 200,
  placeholder = 'Enter SQL query...',
}: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const lines = value.split('\n');
  const lineCount = Math.max(lines.length, 1);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onRun();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.currentTarget.selectionStart;
        const end = e.currentTarget.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          }
        });
      }
    },
    [value, onChange, onRun],
  );

  const handleScroll = () => {
    if (textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
  };

  const renderedLines = Array.from({ length: Math.max(lineCount, 8) }, (_, i) => {
    const line = lines[i] || '';
    const tokens = tokenize(line);
    return (
      <div key={i} className="flex">
        <span className="w-12 shrink-0 text-right pr-3 text-[11px] leading-[22px] text-muted-foreground/40 select-none font-mono">
          {i + 1}
        </span>
        <span className="font-mono text-[13px] leading-[22px] whitespace-pre">
          {tokens.map((t, j) => {
            const cls =
              t.type === 'keyword'
                ? 'text-purple-400'
                : t.type === 'type'
                  ? 'text-blue-400'
                  : t.type === 'string'
                    ? 'text-green-400'
                    : t.type === 'comment'
                      ? 'text-muted-foreground/50 italic'
                      : t.type === 'number'
                        ? 'text-amber-400'
                        : 'text-foreground/90';
            return (
              <span key={j} className={cls}>
                {t.text}
              </span>
            );
          })}
        </span>
      </div>
    );
  });

  return (
    <div
      className="relative rounded-xl border border-border/50 overflow-hidden bg-black/40"
      style={{ minHeight }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/20">
        <span className="text-xs text-muted-foreground font-medium">SQL</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => {
              const formatted = formatSQL(value);
              onChange(formatted);
            }}
          >
            <Sparkles className="h-3 w-3" /> Format
          </Button>
          <Button
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={onRun}
          >
            <Play className="h-3 w-3" /> Run
          </Button>
        </div>
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          className="pointer-events-none p-0"
          style={{
            transform: `translateY(-${scrollTop}px)`,
          }}
        >
          {renderedLines}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            'absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-foreground font-mono text-[13px] leading-[22px] p-0',
            'focus:outline-none',
            'placeholder:text-muted-foreground/30',
            'scrollbar-thin',
          )}
          spellCheck={false}
          style={{
            tabSize: 2,
            MozTabSize: 2,
          }}
        />
      </div>
      {!readOnly && (
        <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/40 pointer-events-none">
          {value.length > 0 ? `${lines.length} lines · ${value.length} chars` : ''}
        </div>
      )}
    </div>
  );
}

export function formatSQL(sql: string): string {
  const upperKeywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE',
    'DROP TABLE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
    'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
    'CROSS JOIN', 'FULL JOIN', 'ON', 'UNION', 'UNION ALL', 'AS',
    'NOT', 'IN', 'LIKE', 'BETWEEN', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'RETURNING', 'EXPLAIN', 'ANALYZE',
  ];

  let formatted = sql.trim();
  for (const kw of upperKeywords) {
    formatted = formatted.replace(
      new RegExp(`\\b${kw}\\b`, 'gi'),
      kw,
    );
  }
  formatted = formatted.replace(/;/g, ';\n');
  formatted = formatted.replace(/\)\s*;/g, ');');
  for (const kw of upperKeywords.filter((k) => !['AS', 'ON', 'AND', 'OR', 'IN', 'LIKE', 'NOT'].includes(k))) {
    formatted = formatted.replace(
      new RegExp(`\\b${kw}\\b`, 'g'),
      `\n${kw}`,
    );
  }
  formatted = formatted.replace(/\n\s*\n/g, '\n');
  return formatted.trim();
}

export default SqlEditor;
