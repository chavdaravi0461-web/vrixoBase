'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SqlEditor } from '@/components/database/sql-editor';
import { QueryResults } from '@/components/database/query-results';
import { useExecuteQuery, useQueryHistory } from '@/hooks/use-database';
import { useProjectStore } from '@/stores/project-store';
import { AiSqlAssistant } from '@/components/ai/ai-sql-assistant';
import {
  Play,
  Save,
  Clock,
  History,
  Trash2,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  X,
  Plus,
  Terminal,
  FileText,
  Download,
  Sparkles,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QueryTab {
  id: string;
  name: string;
  query: string;
  dirty: boolean;
}

export default function SqlPage() {
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: '1', name: 'Query 1', query: 'SELECT * FROM ', dirty: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [queryHistory, setQueryHistory] = useState<{ id: string; query: string; name: string }[]>([]);
  const [savedQueries, setSavedQueries] = useState<{ id: string; name: string; query: string }[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const projectId = useProjectStore((s) => s.currentProject?.id);

  const executeQuery = useExecuteQuery(projectId ?? '');
  const { data: serverHistory } = useQueryHistory(projectId ?? '');

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const setActiveQuery = useCallback(
    (query: string) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, query, dirty: true } : t)),
      );
    },
    [activeTabId],
  );

  const addTab = useCallback(() => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36);
    setTabs((prev) => [
      ...prev,
      { id, name: `Query ${prev.length + 1}`, query: '', dirty: false },
    ]);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        if (filtered.length === 0) {
          const newId = crypto.randomUUID?.() ?? Math.random().toString(36);
          return [{ id: newId, name: 'Query 1', query: '', dirty: false }];
        }
        return filtered;
      });
      if (activeTabId === id) {
        setActiveTabId(tabs[0]?.id ?? '');
      }
    },
    [activeTabId, tabs],
  );

  const handleRun = useCallback(() => {
    if (!activeTab?.query.trim()) return;
    executeQuery.mutate(activeTab.query, {
      onSuccess: () => {
        setQueryHistory((prev) => [
          { id: Date.now().toString(), query: activeTab.query, name: activeTab.name },
          ...prev,
        ]);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, dirty: false } : t)),
        );
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  }, [activeTab, activeTabId, executeQuery]);

  const handleFormat = useCallback(() => {
    if (!activeTab) return;
    const formatted = formatBasicSQL(activeTab.query);
    setActiveQuery(formatted);
    toast.success('Query formatted');
  }, [activeTab, setActiveQuery]);

  const handleSave = useCallback(() => {
    if (!activeTab?.query.trim()) return;
    setSaveName(activeTab.name);
    setSaveDialog(true);
  }, [activeTab]);

  const confirmSave = useCallback(() => {
    if (!saveName.trim() || !activeTab) return;
    setSavedQueries((prev) => [
      ...prev,
      { id: Date.now().toString(), name: saveName.trim(), query: activeTab.query },
    ]);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, name: saveName.trim() } : t)),
    );
    setSaveDialog(false);
    toast.success('Query saved');
  }, [saveName, activeTab, activeTabId]);

  const loadQuery = useCallback(
    (query: string) => {
      setActiveQuery(query);
      toast.success('Query loaded');
    },
    [setActiveQuery],
  );

  const deleteSavedQuery = useCallback((id: string) => {
    setSavedQueries((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const handleExportCSV = useCallback(() => {
    if (executeQuery.data) {
      const headers = executeQuery.data.columns.map((c: { name: string }) => c.name);
      const rows = executeQuery.data.rows.map((row: Record<string, unknown>) =>
        headers.map((h: string) => {
          const v = row[h];
          if (v == null) return '';
          const s = String(v);
          return s.includes(',') ? `"${s}"` : s;
        }),
      );
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    }
  }, [executeQuery.data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  const filteredHistory = queryHistory.filter((h) =>
    h.query.toLowerCase().includes(historySearch.toLowerCase()),
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/30">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap',
                  tab.id === activeTabId
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                <FileText className="h-3 w-3" />
                {tab.name}
                {tab.dirty && <span className="text-muted-foreground/50">*</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 rounded-sm hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addTab}
              className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleFormat}
            >
              <Sparkles className="h-3.5 w-3.5" /> Format
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            {executeQuery.data && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleExportCSV}
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleRun}
              disabled={executeQuery.isPending}
            >
              <Play className="h-3.5 w-3.5" /> Run
              <kbd className="hidden sm:inline-flex ml-1 items-center gap-0.5 rounded border border-primary-foreground/20 px-1.5 py-0.5 text-[9px] font-mono">
                ⌘↵
              </kbd>
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 pb-2">
            <SqlEditor
              value={activeTab?.query ?? ''}
              onChange={setActiveQuery}
              onRun={handleRun}
              minHeight={180}
              placeholder="Enter your SQL query here..."
            />
          </div>

          <div className="px-4 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
            {executeQuery.isPending && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Running query...
              </div>
            )}
            {executeQuery.data && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Success
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {executeQuery.data.duration_ms?.toFixed(1) ?? '0'} ms
                </span>
                <span>
                  {executeQuery.data.rowCount} row{executeQuery.data.rowCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {executeQuery.error && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {executeQuery.error.message}
              </div>
            )}
          </div>

          <div className="flex-1 px-4 pb-4 min-h-0 overflow-auto">
            <QueryResults
              result={executeQuery.data ?? null}
              loading={executeQuery.isPending}
              error={executeQuery.error?.message ?? null}
            />
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/50 bg-card/20 shrink-0 hidden xl:flex flex-col">
        <div className="p-3 border-b border-border/30">
          <button
            onClick={() => { setShowHistory(true); setShowSaved(false); setShowAIAssistant(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
              showHistory && !showAIAssistant ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <History className="h-3.5 w-3.5" /> Recent Queries
          </button>
          <button
            onClick={() => { setShowSaved(true); setShowHistory(false); setShowAIAssistant(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-colors mt-0.5',
              showSaved && !showAIAssistant ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Save className="h-3.5 w-3.5" /> Saved Queries
          </button>
          <button
            onClick={() => { setShowAIAssistant(!showAIAssistant); setShowHistory(false); setShowSaved(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-colors mt-0.5',
              showAIAssistant ? 'bg-gradient-to-r from-brand-500/20 to-violet-500/20 text-brand-400' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Bot className="h-3.5 w-3.5" /> AI Assistant
          </button>
        </div>

        {!showAIAssistant && (
          <div className="p-2">
            <Input
              placeholder="Search..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        )}

        {showAIAssistant ? (
          <AiSqlAssistant
            onInsertSql={(sql) => setActiveQuery(sql)}
            onExecute={(sql) => {
              setActiveQuery(sql);
              setTimeout(() => {
                const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' });
                window.dispatchEvent(event);
              }, 100);
            }}
          />
        ) : (
          <ScrollArea className="flex-1">
            {(showHistory ? filteredHistory : savedQueries).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Terminal className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  {showHistory ? 'No recent queries' : 'No saved queries'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {(showHistory ? filteredHistory : savedQueries).map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-lg p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => loadQuery(item.query)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{item.name}</span>
                      {showHistory ? (
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedQuery(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      )}
                    </div>
                    <pre className="text-[10px] text-muted-foreground/60 font-mono truncate leading-relaxed">
                      {item.query.slice(0, 80)}{item.query.length > 80 ? '...' : ''}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      {saveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-sm">Save Query</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Query name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmSave();
                  if (e.key === 'Escape') setSaveDialog(false);
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSaveDialog(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={confirmSave}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatBasicSQL(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE',
    'DROP TABLE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
    'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
    'ON', 'UNION', 'UNION ALL', 'RETURNING',
  ];

  let result = sql.trim();
  for (const kw of keywords) {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'gi'), `\n${kw}`);
  }
  result = result.replace(/;/g, ';\n');
  result = result.replace(/\n{2,}/g, '\n');
  result = result.replace(/\)\s*;/g, ');');
  result = result.replace(/\(\s*/g, '(');
  result = result.replace(/\s*\)/g, ')');
  return result.trim();
}
