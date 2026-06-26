'use client';

import { useState } from 'react';
import {
  Code2, Plus, Play, Terminal, Clock, BarChart3, Webhook,
  Settings2, Zap, Trash2, X, Check, Copy, ExternalLink,
  Globe, Key, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { CodeBlock } from '@/components/common/code-block';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable } from '@/components/common/data-table';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useFunctions, useFunction, useCreateFunction, useUpdateFunction, useDeleteFunction, useExecuteFunction, useExecutionLogs } from '@/hooks/use-functions';
import { useProjectStore } from '@/stores/project-store';
import type { FunctionItem as FunctionType, ExecutionRecord } from '@/lib/api/functions';

const RUNTIMES = [
  { value: 'node18', label: 'Node.js 18' },
  { value: 'node20', label: 'Node.js 20' },
  { value: 'python3', label: 'Python 3.11' },
] as const;

export default function FunctionsPage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);

  const { data: functions, isLoading, refetch } = useFunctions(projectId ?? '');
  const createFunction = useCreateFunction(projectId ?? '');
  const updateFunction = useUpdateFunction(projectId ?? '');
  const deleteFunction = useDeleteFunction(projectId ?? '');
  const executeFunction = useExecuteFunction(projectId ?? '');
  const functionList = functions || [];

  const [selectedFn, setSelectedFn] = useState<FunctionType | null>(null);
  const { data: executions } = useExecutionLogs(projectId ?? '', selectedFn?.id ?? '');
  const executionList = executions || [];

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'test' | 'history' | 'webhook' | 'env'>('code');

  const [testInput, setTestInput] = useState('{\n  "body": {\n    "orderId": "ord_123"\n  }\n}');
  const [testOutput, setTestOutput] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const [code, setCode] = useState('');
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [newFnName, setNewFnName] = useState('');
  const [newFnRuntime, setNewFnRuntime] = useState('node20');
  const [newFnCode, setNewFnCode] = useState('export default async function(req) {\n  return { message: "Hello from VrixoBase!" };\n}');

  const handleSelect = (fn: FunctionType) => {
    setSelectedFn(fn);
    setCode(fn.source);
    setEnvVars(fn.environmentVariables);
    setWebhookUrl(fn.webhookUrl || '');
    setTestOutput('');
    setView('detail');
    setActiveTab('code');
  };

  const handleTest = async () => {
    if (!selectedFn) return;
    setTestLoading(true);
    setTestOutput('');
    try {
      let payload;
      try { payload = JSON.parse(testInput); } catch { payload = { body: testInput }; }
      const result = await executeFunction.mutateAsync({ id: selectedFn.id, payload });
      setTestOutput(JSON.stringify(result, null, 2));
    } catch (err: any) {
      setTestOutput(JSON.stringify({ error: err.message }, null, 2));
    }
    setTestLoading(false);
  };

  const handleSaveCode = () => {
    if (!selectedFn) return;
    updateFunction.mutate({ id: selectedFn.id, input: { sourceCode: code } }, {
      onSuccess: () => toast.success('Function code saved'),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleCreateFn = () => {
    if (!newFnName.trim()) { toast.error('Enter a function name'); return; }
    createFunction.mutate({
      name: newFnName.trim(),
      runtime: newFnRuntime,
      sourceCode: newFnCode,
    }, {
      onSuccess: () => {
        toast.success('Function created');
        setShowCreate(false);
        setNewFnName('');
        setNewFnCode('export default async function(req) {\n  return { message: "Hello from VrixoBase!" };\n}');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDelete = () => {
    if (!deleteId || !projectId) return;
    deleteFunction.mutate(deleteId, {
      onSuccess: () => { toast.success('Function deleted'); setDeleteId(null); if (view === 'detail') setView('list'); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleAddEnv = () => {
    if (!envKey.trim()) return;
    setEnvVars((prev) => ({ ...prev, [envKey.trim()]: envVal }));
    setEnvKey('');
    setEnvVal('');
  };

  const handleRemoveEnv = (key: string) => {
    setEnvVars((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSaveEnv = () => {
    if (!selectedFn) return;
    updateFunction.mutate({ id: selectedFn.id, input: { environmentVariables: envVars } as any }, {
      onSuccess: () => toast.success('Environment variables saved'),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleSaveWebhook = () => {
    if (!selectedFn) return;
    updateFunction.mutate({ id: selectedFn.id, input: { webhookUrl } as any }, {
      onSuccess: () => toast.success('Webhook URL saved'),
      onError: (err) => toast.error(err.message),
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Code2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to manage functions.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  if (view === 'detail' && selectedFn) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{selectedFn.name}</h1>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  selectedFn.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  selectedFn.status === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                )}>
                  {selectedFn.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Runtime: {RUNTIMES.find(r => r.value === selectedFn.runtime)?.label || selectedFn.runtime}</p>
            </div>
          </div>
          <button
            onClick={handleSaveCode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            <Check className="h-4 w-4" /> Save
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          {(['code', 'test', 'history', 'webhook', 'env'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'code' && <Code2 className="h-3.5 w-3.5" />}
              {tab === 'test' && <Play className="h-3.5 w-3.5" />}
              {tab === 'history' && <Clock className="h-3.5 w-3.5" />}
              {tab === 'webhook' && <Webhook className="h-3.5 w-3.5" />}
              {tab === 'env' && <Key className="h-3.5 w-3.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'code' && (
            <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-brand-400" />
                    <span className="text-sm font-medium">index.js</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{selectedFn.timeout}s timeout</span>
                  </div>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full min-h-[400px] p-5 bg-[#0a0a0f] text-gray-300 font-mono text-[13px] leading-relaxed focus:outline-none resize-none scrollbar-thin"
                  spellCheck={false}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'test' && (
            <motion.div key="test" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground">Input JSON</label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={12}
                  className="w-full p-4 rounded-xl border border-border bg-[#0a0a0f] text-xs font-mono text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                  spellCheck={false}
                />
                <button
                  onClick={handleTest}
                  disabled={testLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium transition-colors w-fit"
                >
                  {testLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Execute
                </button>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground">Output</label>
                {testOutput ? (
                  <CodeBlock code={testOutput} language="json" title="Response" maxHeight="400px" />
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px] rounded-xl border border-dashed border-border">
                    <div className="text-center">
                      <Terminal className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Run a test to see output</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <DataTable
                  columns={[
                    { key: 'status', header: 'Status', render: (row: ExecutionRecord) => (
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        row.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                        row.status === 'error' ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10'
                      )}>{row.status}</span>
                    )},
                    { key: 'duration', header: 'Duration', render: (row: ExecutionRecord) => `${row.duration ?? '-'}ms` },
                    { key: 'input', header: 'Input', render: (row: ExecutionRecord) => (
                      <code className="text-[11px] font-mono text-muted-foreground truncate max-w-[200px] inline-block">{row.input || '-'}</code>
                    )},
                    { key: 'output', header: 'Output', render: (row: ExecutionRecord) => (
                      <code className="text-[11px] font-mono text-muted-foreground truncate max-w-[200px] inline-block">{row.output || row.error || '-'}</code>
                    )},
                    { key: 'triggeredAt', header: 'Executed', sortable: true, render: (row: ExecutionRecord) => formatDateTime(row.triggeredAt) },
                  ]}
                  data={executionList}
                  keyExtractor={(row) => row.id}
                  pageSize={5}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'webhook' && (
            <motion.div key="webhook" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Webhook className="h-5 w-5 text-brand-400" />
                  <h3 className="text-base font-semibold">Webhook Configuration</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Webhook URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.example.com/endpoint"
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                    />
                    <button onClick={handleSaveWebhook} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">Save</button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Function will be triggered via HTTP POST to this URL</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs font-medium mb-1">Example Webhook Payload</p>
                  <code className="text-[10px] font-mono text-muted-foreground">
                    {`{\n  "event": "function.invoked",\n  "function": "${selectedFn.name}",\n  "timestamp": "${new Date().toISOString()}"\n}`}
                  </code>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'env' && (
            <motion.div key="env" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-brand-400" />
                    <h3 className="text-base font-semibold">Environment Variables</h3>
                  </div>
                  <button onClick={handleSaveEnv} className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors">Save</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={envKey}
                    onChange={(e) => setEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="KEY_NAME"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                  <input
                    type="text"
                    value={envVal}
                    onChange={(e) => setEnvVal(e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button onClick={handleAddEnv} className="px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {Object.entries(envVars).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No environment variables</p>
                  ) : (
                    Object.entries(envVars).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 p-3 rounded-lg border border-border">
                        <code className="text-xs font-mono text-brand-400 font-medium">{key}</code>
                        <span className="text-xs text-muted-foreground">=</span>
                        <span className="text-xs font-mono text-muted-foreground">••••••••</span>
                        <button onClick={() => handleRemoveEnv(key)} className="ml-auto p-1 rounded hover:bg-destructive/10 text-destructive transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Functions</h1>
          <p className="text-sm text-muted-foreground mt-1">Run serverless functions in Node.js and Python</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Create Function
          </button>
        </div>
      </div>

      {functionList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border">
          <Code2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">No functions yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first serverless function</p>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" /> Create Function
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {functionList.map((fn, idx) => (
            <motion.button
              key={fn.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleSelect(fn)}
              className="group text-left rounded-xl border border-border bg-card p-5 hover:border-brand-500/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Zap className="h-5 w-5 text-violet-400" />
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  fn.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  fn.status === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                )}>
                  {fn.status}
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1 truncate group-hover:text-brand-400 transition-colors">{fn.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">{fn.runtime === 'node20' ? 'Node 20' : fn.runtime === 'node18' ? 'Node 18' : 'Python 3'}</span>
                <span className="text-[10px] text-muted-foreground">{fn.executionCount.toLocaleString()} execs</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Last: {fn.lastExecutedAt ? formatDateTime(fn.lastExecutedAt) : 'Never'}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Create Function</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Function Name</label>
                  <input type="text" value={newFnName} onChange={(e) => setNewFnName(e.target.value)} placeholder="my-function" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Runtime</label>
                  <select value={newFnRuntime} onChange={(e) => setNewFnRuntime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500">
                    {RUNTIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Initial Code</label>
                  <textarea value={newFnCode} onChange={(e) => setNewFnCode(e.target.value)} rows={6} className="w-full p-3 rounded-lg border border-border bg-[#0a0a0f] text-xs font-mono text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none" spellCheck={false} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleCreateFn} disabled={createFunction.isPending} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {createFunction.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Function"
        description="This will permanently delete the function and all execution history."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
