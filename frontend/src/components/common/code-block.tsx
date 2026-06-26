'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
  maxHeight?: string;
}

export function CodeBlock({ code, language = 'plaintext', title, className, maxHeight }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden bg-[#0a0a0f]', className)}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
          <span className="text-xs text-muted-foreground font-mono">{title}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{language}</span>
        </div>
      )}
      <div className="relative group">
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-card/80 border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
          title="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        <pre
          className={cn('p-4 overflow-x-auto scrollbar-thin text-sm', maxHeight && 'overflow-y-auto')}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <code className="font-mono text-[13px] leading-relaxed text-gray-300 whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

export function generateCurl(endpoint: string, method: string, headers?: Record<string, string>, body?: string): string {
  const lines: string[] = [`curl -X ${method.toUpperCase()} "${endpoint}"`];
  if (headers) {
    for (const [key, val] of Object.entries(headers)) {
      lines.push(`  -H "${key}: ${val}"`);
    }
  }
  if (body) {
    lines.push(`  -d '${body}'`);
  }
  return lines.join(' \\\n');
}

export function generateFetch(endpoint: string, method: string, headers?: Record<string, string>, body?: string): string {
  const opts: Record<string, string> = { method: method.toUpperCase() };
  if (headers) opts.headers = JSON.stringify(headers, null, 2);
  if (body) opts.body = body;
  return `fetch("${endpoint}", ${JSON.stringify(opts, null, 2)})`;
}

export function generatePython(endpoint: string, method: string, headers?: Record<string, string>, body?: string): string {
  const lines: string[] = [
    'import requests',
    '',
    `response = requests.${method.toLowerCase()}("${endpoint}"`,
  ];
  if (headers) {
    lines.push(`    headers=${JSON.stringify(headers, null, 2)},`);
  }
  if (body) {
    lines.push(`    json=${body},`);
  }
  lines.push(')');
  lines.push('');
  lines.push('print(response.status_code)');
  lines.push('print(response.json())');
  return lines.join('\n');
}
