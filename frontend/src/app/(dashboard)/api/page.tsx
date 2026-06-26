'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Key, Plus, Copy, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Code,
  ExternalLink, RefreshCw, Play, Send, Server, FileText, Clock, Shield,
  X, Check, AlertTriangle, Database, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { CodeBlock, generateCurl, generateFetch, generatePython } from '@/components/common/code-block';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/use-api-keys';
import { useTables } from '@/hooks/use-database';
import { useProjectStore } from '@/stores/project-store';
import type { ApiKey } from '@/lib/api/api-keys';

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
}

interface EndpointGroup {
  table: string;
  endpoints: Endpoint[];
}

const TABLE_ENDPOINTS: Record<string, Endpoint[]> = {
  list: [
    { method: 'GET', path: '/api/v1/rest/v1/{table}', description: 'List all records' },
  ],
  get: [
    { method: 'GET', path: '/api/v1/rest/v1/{table}/:id', description: 'Get a record by ID' },
  ],
  create: [
    { method: 'POST', path: '/api/v1/rest/v1/{table}', description: 'Create a new record' },
  ],
  update: [
    { method: 'PATCH', path: '/api/v1/rest/v1/{table}/:id', description: 'Update a record' },
  ],
  delete: [
    { method: 'DELETE', path: '/api/v1/rest/v1/{table}/:id', description: 'Delete a record' },
  ],
};

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  POST: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  PATCH: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

export default function ApiPage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const { data: keysData, isLoading, refetch } = useApiKeys(projectId ?? '');
  const createKey = useCreateApiKey(projectId ?? '');
  const revokeKey = useRevokeApiKey(projectId ?? '');
  const { data: dbTables } = useTables(projectId ?? '');

  const endpoints: EndpointGroup[] = useMemo(() => {
    if (!dbTables || dbTables.length === 0) return [];
    return dbTables.map((t) => ({
      table: t.name,
      endpoints: [
        { method: 'GET' as const, path: `/api/v1/rest/v1/${t.name}`, description: `List all ${t.name}` },
        { method: 'GET' as const, path: `/api/v1/rest/v1/${t.name}/:id`, description: `Get ${t.name} by ID` },
        { method: 'POST' as const, path: `/api/v1/rest/v1/${t.name}`, description: `Create a ${t.name}` },
        { method: 'PATCH' as const, path: `/api/v1/rest/v1/${t.name}/:id`, description: `Update ${t.name}` },
        { method: 'DELETE' as const, path: `/api/v1/rest/v1/${t.name}/:id`, description: `Delete ${t.name}` },
      ],
    }));
  }, [dbTables]);

  const keys = keysData || [];

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [playgroundTab, setPlaygroundTab] = useState<'curl' | 'fetch' | 'python'>('curl');

  const [method, setMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [requestHeaders, setRequestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<'PUBLIC' | 'SECRET'>('SECRET');
  const [createdKeyRaw, setCreatedKeyRaw] = useState<string | null>(null);

  const handleCreateKey = () => {
    if (!newKeyName.trim()) { toast.error('Please enter a key name'); return; }
    createKey.mutate({ name: newKeyName.trim(), type: newKeyType }, {
      onSuccess: (data) => {
        setCreatedKeyRaw(data.rawKey || '');
        toast.success(`API key "${newKeyName}" created successfully`);
        setNewKeyName('');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleRevokeKey = (id: string) => {
    revokeKey.mutate(id, {
      onSuccess: () => { toast.success('API key revoked successfully'); setShowRevokeDialog(null); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard');
  };

  const handleSendRequest = useCallback(async () => {
    if (!endpointUrl) return;
    setSending(true);
    setResponse('');

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const token = typeof window !== 'undefined' ? localStorage.getItem('vrixo_access_token') : null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const parsedBody = requestBody ? JSON.parse(requestBody) : undefined;

      const startTime = performance.now();
      const res = await fetch(`${apiBase}${endpointUrl.startsWith('/') ? endpointUrl : `/${endpointUrl}`}`, {
        method,
        headers,
        body: method !== 'GET' && method !== 'DELETE' && parsedBody ? JSON.stringify(parsedBody) : undefined,
      });
      const duration = (performance.now() - startTime).toFixed(1);

      const body = await res.json().catch(() => null);

      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });

      setResponse(JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        duration: `${duration}ms`,
        headers: respHeaders,
        data: body,
      }, null, 2));
    } catch (err: any) {
      setResponse(JSON.stringify({
        status: 0,
        statusText: 'Network Error',
        error: err.message,
      }, null, 2));
    }

    setSending(false);
  }, [endpointUrl, method, requestBody]);

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Key className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to manage API keys.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage API keys, explore endpoints, and test your API</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Server className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">API Endpoints</h2>
            </div>
            <div className="divide-y divide-border">
              {endpoints.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Database className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p>No tables found. Create tables in Database to see API endpoints.</p>
                </div>
              ) : endpoints.map((group) => (
                <div key={group.table}>
                  <button
                    onClick={() => setExpandedEndpoint(expandedEndpoint === group.table ? null : group.table)}
                    className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                  >
                    {expandedEndpoint === group.table ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{group.table}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{group.endpoints.length} endpoints</span>
                  </button>
                  <AnimatePresence>
                    {expandedEndpoint === group.table && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-5 pb-3 space-y-2">
                          {group.endpoints.map((ep) => (
                            <div key={ep.path} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                              <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono font-semibold border', methodColors[ep.method])}>
                                {ep.method}
                              </span>
                              <code className="text-xs font-mono text-muted-foreground truncate">{ep.path}</code>
                              <span className="text-xs text-muted-foreground ml-auto hidden sm:block">{ep.description}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Play className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">REST Playground</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {['GET', 'POST', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://api.vrixobase.com/rest/v1/users"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
                <button
                  onClick={handleSendRequest}
                  disabled={sending || !endpointUrl}
                  className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Headers</label>
                  <textarea
                    value={requestHeaders}
                    onChange={(e) => setRequestHeaders(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-[#0a0a0f] text-xs font-mono text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Body</label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    rows={4}
                    placeholder='{"key": "value"}'
                    className="w-full px-3 py-2 rounded-lg border border-border bg-[#0a0a0f] text-xs font-mono text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              {response && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Response</label>
                  <CodeBlock code={response} language="json" title="Response" maxHeight="300px" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-brand-400" />
                <h2 className="text-sm font-semibold">API Keys</h2>
              </div>
              <button
                onClick={() => { setCreatedKeyRaw(null); setShowCreateDialog(true); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {keys.length === 0 ? (
                <div className="p-8 text-center">
                  <Key className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No API keys yet</p>
                  <button onClick={() => { setCreatedKeyRaw(null); setShowCreateDialog(true); }} className="mt-2 text-xs text-brand-400 hover:underline">Create one</button>
                </div>
              ) : (
                keys.map((k) => (
                  <div key={k.id}>
                    <button
                      onClick={() => setExpandedKey(expandedKey === k.id ? null : k.id)}
                      className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        k.revoked ? 'bg-destructive' : k.type === 'SECRET' ? 'bg-amber-400' : 'bg-emerald-400'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{k.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{k.key}</p>
                      </div>
                      <span className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold',
                        k.type === 'SECRET' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                      )}>
                        {k.type}
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedKey === k.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="px-5 pb-4 space-y-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCopyKey(k.key)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors"
                              >
                                <Copy className="h-3 w-3" /> Copy
                              </button>
                              <button
                                onClick={() => setRevealedKeys((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(k.id)) next.delete(k.id); else next.add(k.id);
                                  return next;
                                })}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors"
                              >
                                {revealedKeys.has(k.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {revealedKeys.has(k.id) ? 'Hide' : 'Reveal'}
                              </button>
                              <button
                                onClick={() => setShowRevokeDialog(k.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" /> Revoke
                              </button>
                            </div>
                            {revealedKeys.has(k.id) && (
                              <div className="p-2 rounded-lg bg-muted/30 border border-border">
                                <code className="text-xs font-mono text-amber-400 break-all">{k.key}</code>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                Last used: {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : 'Never'}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Shield className="h-3 w-3" />
                                Created: {formatDate(k.createdAt)}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Code className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">Code Snippets</h2>
            </div>
            <div className="p-5">
              <div className="flex gap-1 mb-4 p-1 rounded-lg bg-muted/50">
                {(['curl', 'fetch', 'python'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPlaygroundTab(tab)}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      playgroundTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'curl' ? 'cURL' : tab === 'fetch' ? 'JavaScript' : 'Python'}
                  </button>
                ))}
              </div>
              <CodeBlock
                code={
                  playgroundTab === 'curl'
                    ? generateCurl(endpointUrl || 'https://api.vrixobase.com/rest/v1/users', method, JSON.parse(requestHeaders || '{}'), requestBody)
                    : playgroundTab === 'fetch'
                    ? generateFetch(endpointUrl || 'https://api.vrixobase.com/rest/v1/users', method, JSON.parse(requestHeaders || '{}'), requestBody)
                    : generatePython(endpointUrl || 'https://api.vrixobase.com/rest/v1/users', method, JSON.parse(requestHeaders || '{}'), requestBody)
                }
                language={playgroundTab === 'curl' ? 'bash' : playgroundTab === 'fetch' ? 'javascript' : 'python'}
                title="Code snippet"
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreateDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Create API Key</h3>
                <button onClick={() => setShowCreateDialog(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production, CI/CD..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Key Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['PUBLIC', 'SECRET'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewKeyType(t)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
                          newKeyType === t
                            ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                            : 'border-border hover:border-muted-foreground/30'
                        )}
                      >
                        <div className={cn('w-2 h-2 rounded-full shrink-0', t === 'SECRET' ? 'bg-amber-400' : 'bg-emerald-400')} />
                        <span className="font-medium">{t}</span>
                        {newKeyType === t && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {newKeyType === 'SECRET'
                      ? 'Secret keys have full access to all resources. Keep them secure.'
                      : 'Public keys are safe to use in client-side code with restricted access.'}
                  </p>
                </div>
                {createdKeyRaw && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Copy this key now. It will not be shown again.
                    </div>
                    <div className="flex gap-2">
                      <code className="flex-1 p-2 rounded bg-[#0a0a0f] text-xs font-mono text-amber-400 break-all">{createdKeyRaw}</code>
                      <button onClick={() => handleCopyKey(createdKeyRaw)} className="p-2 rounded border border-border hover:bg-muted">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreateDialog(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreateKey} disabled={createKey.isPending} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {createKey.isPending ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!showRevokeDialog}
        onOpenChange={() => setShowRevokeDialog(null)}
        onConfirm={() => showRevokeDialog && handleRevokeKey(showRevokeDialog)}
        title="Revoke API Key"
        description="This will immediately invalidate this API key. Any services using it will lose access. This action cannot be undone."
        confirmText="Revoke Key"
        variant="destructive"
      />
    </div>
  );
}
