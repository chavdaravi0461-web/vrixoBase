'use client';

import { useState, useMemo } from 'react';
import {
  Key, Plus, Copy, Check, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Code,
  ExternalLink, Server, Database, Loader2, AlertTriangle, Shield,
  BookOpen, MessageSquare, HelpCircle, Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { CodeBlock, generateCurl, generateFetch, generatePython } from '@/components/common/code-block';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn, formatDateTime } from '@/lib/utils';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/use-api-keys';
import { useTables } from '@/hooks/use-database';
import { useProjectStore } from '@/stores/project-store';
import type { ApiKey } from '@/lib/api/api-keys';

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  POST: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  PATCH: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return key.substring(0, 18) + '••••••••••••••••';
}

interface KeyCardProps {
  apiKey: ApiKey;
  onRevoke: (id: string) => void;
}

function KeyCard({ apiKey, onRevoke }: KeyCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{apiKey.name}</p>
            <p className="text-xs text-muted-foreground">No description</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleCopy(apiKey.key)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Copy key"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
            <button
              onClick={() => setRevealed(!revealed)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title={revealed ? 'Hide key' : 'Reveal key'}
            >
              {revealed ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 font-mono text-sm bg-muted/50 border border-border/60 rounded-lg px-3 py-2.5 truncate">
            {revealed ? apiKey.key : maskKey(apiKey.key)}
          </div>
          <button
            onClick={() => onRevoke(apiKey.id)}
            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            title="Revoke key"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Created {formatDateTime(apiKey.createdAt)}</span>
          {apiKey.lastUsedAt && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span>Last used {formatDateTime(apiKey.lastUsedAt)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateKeyModalProps {
  open: boolean;
  onClose: () => void;
  defaultType: 'PUBLIC' | 'SECRET';
}

function CreateKeyModal({ open, onClose, defaultType }: CreateKeyModalProps) {
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const createKey = useCreateApiKey(projectId ?? '');

  const [name, setName] = useState('');
  const [keyType, setKeyType] = useState<'PUBLIC' | 'SECRET'>(defaultType);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Please enter a key name'); return; }
    createKey.mutate({ name: name.trim(), type: keyType }, {
      onSuccess: (data) => {
        setCreatedKey(data.rawKey || '');
        toast.success(`"${name.trim()}" key created`);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName('');
    setKeyType(defaultType);
    setCreatedKey(null);
    setCopied(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
          >
            {createdKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-500/10">
                    <Key className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Key created!</h3>
                    <p className="text-sm text-muted-foreground">
                      Copy this key now. You won't be able to see it again.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <code className="flex-1 p-3 rounded-lg bg-[#0a0a0f] border border-border/60 text-xs font-mono text-brand-400 break-all">
                    {createdKey}
                  </code>
                  <button onClick={handleCopy} className="p-3 rounded-lg border border-border hover:bg-muted transition-colors">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    New {keyType === 'PUBLIC' ? 'publishable' : 'secret'} key
                  </h3>
                  <button onClick={handleClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="default"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Key type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['PUBLIC', 'SECRET'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setKeyType(t)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
                          keyType === t
                            ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                            : 'border-border hover:border-muted-foreground/30'
                        )}
                      >
                        <div className={cn('w-2 h-2 rounded-full shrink-0', t === 'SECRET' ? 'bg-amber-400' : 'bg-emerald-400')} />
                        <span className="font-medium">{t === 'PUBLIC' ? 'Publishable' : 'Secret'}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {keyType === 'SECRET'
                      ? 'Secret keys have full access. Use in servers, functions, or backend components.'
                      : 'Publishable keys are safe to use in browsers with RLS enabled.'}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={createKey.isPending}
                    className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {createKey.isPending ? 'Creating...' : 'Create key'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ApiPage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const { data: keysData, isLoading, refetch } = useApiKeys(projectId ?? '');
  const revokeKey = useRevokeApiKey(projectId ?? '');
  const { data: dbTables } = useTables(projectId ?? '');

  const keys = keysData || [];
  const publicKeys = keys.filter((k) => k.type === 'PUBLIC');
  const secretKeys = keys.filter((k) => k.type === 'SECRET');

  const [showCreatePublic, setShowCreatePublic] = useState(false);
  const [showCreateSecret, setShowCreateSecret] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState<string | null>(null);

  const [playgroundTab, setPlaygroundTab] = useState<'curl' | 'fetch' | 'python'>('curl');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [requestHeaders, setRequestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const handleRevokeKey = (id: string) => {
    revokeKey.mutate(id, {
      onSuccess: () => { toast.success('API key revoked'); setShowRevokeDialog(null); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleSendRequest = async () => {
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
  };

  const endpoints = useMemo(() => {
    if (!dbTables || dbTables.length === 0) return [];
    return dbTables.map((t: any) => ({
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
    <div className="space-y-8 pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); toast.info('Documentation coming soon'); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          Docs
        </a>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-500/10 shrink-0 mt-0.5">
            <Key className="h-4 w-4 text-brand-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Publishable and secret API keys</h2>
            <p className="text-sm text-muted-foreground">
              Legacy <code className="text-xs bg-muted/50 px-1 rounded">anon</code>,{' '}
              <code className="text-xs bg-muted/50 px-1 rounded">service_role</code> API keys
            </p>
            <div className="flex items-center gap-3 pt-1">
              <p className="text-xs text-muted-foreground">Your new API keys are here</p>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); toast.info('Discussion coming soon'); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                Join the discussion on GitHub
              </a>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Having trouble with the new API keys?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Support coming soon'); }} className="text-brand-400 hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Publishable keys */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Publishable key</h2>
            <p className="text-sm text-muted-foreground">
              This key is safe to use in a browser if you have enabled Row Level Security (RLS){' '}
              for your tables and configured policies.
            </p>
          </div>
          <button
            onClick={() => setShowCreatePublic(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New publishable key
          </button>
        </div>

        {publicKeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center">
            <Key className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No publishable keys yet</p>
            <button
              onClick={() => setShowCreatePublic(true)}
              className="mt-2 text-xs text-brand-400 hover:underline"
            >
              Create a publishable key
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {publicKeys.map((k) => (
              <KeyCard key={k.id} apiKey={k} onRevoke={(id) => setShowRevokeDialog(id)} />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Publishable keys can be safely shared publicly
        </p>
      </div>

      {/* Secret keys */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Secret keys</h2>
            <p className="text-sm text-muted-foreground">
              These API keys allow privileged access to your project's APIs.{' '}
              Use in servers, functions, workers or other backend components of your application.
            </p>
          </div>
          <button
            onClick={() => setShowCreateSecret(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New secret key
          </button>
        </div>

        {secretKeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center">
            <Key className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No secret keys yet</p>
            <button
              onClick={() => setShowCreateSecret(true)}
              className="mt-2 text-xs text-brand-400 hover:underline"
            >
              Create a secret key
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {secretKeys.map((k) => (
              <KeyCard key={k.id} apiKey={k} onRevoke={(id) => setShowRevokeDialog(id)} />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Secret keys should never be shared publicly
        </p>
      </div>

      {/* Legacy API Keys */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Legacy API keys</h2>
        </div>
        <div className="divide-y divide-border">
          {/* anon key */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">anon</code>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">public</span>
                </div>
                <code className="text-xs font-mono text-muted-foreground truncate max-w-[200px] hidden sm:block">
                  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                </code>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              This key is safe to use in a browser if you have enabled Row Level Security for your tables and configured policies.{' '}
              <span className="text-primary hover:underline cursor-pointer" onClick={() => toast.info('Prefer using Publishable API keys instead.')}>
                Prefer using Publishable API keys instead.
              </span>
            </p>
          </div>

          {/* service_role key */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">service_role</code>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">secret</span>
                </div>
                <code className="text-xs font-mono text-muted-foreground select-none">
                  ••••••••••••••••••••••••••••
                </code>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Eye className="h-3 w-3" /> Reveal
                </button>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              This key has the ability to bypass Row Level Security. Never share it publicly.{' '}
              If leaked, generate a new JWT secret immediately.{' '}
              <span className="text-primary hover:underline cursor-pointer" onClick={() => toast.info('Prefer using Secret API keys instead.')}>
                Prefer using Secret API keys instead.
              </span>
            </p>
          </div>

          {/* Disable legacy keys */}
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Disable legacy API keys</p>
                <p className="text-xs text-muted-foreground">
                  Make sure you are no longer using your legacy API keys before proceeding.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500" />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => toast.info('JWT-based API keys will be disabled in a future update.')}
                className="px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-colors"
              >
                Disable JWT-based API keys
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create modals */}
      <CreateKeyModal open={showCreatePublic} onClose={() => setShowCreatePublic(false)} defaultType="PUBLIC" />
      <CreateKeyModal open={showCreateSecret} onClose={() => setShowCreateSecret(false)} defaultType="SECRET" />

      {/* Revoke confirm */}
      <ConfirmDialog
        open={!!showRevokeDialog}
        onOpenChange={() => setShowRevokeDialog(null)}
        onConfirm={() => showRevokeDialog && handleRevokeKey(showRevokeDialog)}
        title="Revoke API Key"
        description="This will immediately invalidate this API key. Any services using it will lose access. This action cannot be undone."
        confirmText="Revoke Key"
        variant="destructive"
      />

      {/* Divider before playground */}
      <hr className="border-border/60" />

      {/* REST Playground */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">REST Playground</h2>

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
            placeholder="/api/v1/rest/v1/users"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
          />
          <button
            onClick={handleSendRequest}
            disabled={sending || !endpointUrl}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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

      {/* Code Snippets */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Code Snippets</h2>
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          {(['curl', 'fetch', 'python'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPlaygroundTab(tab)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
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
              ? generateCurl(endpointUrl || '/api/v1/rest/v1/users', method, JSON.parse(requestHeaders || '{}'), requestBody)
              : playgroundTab === 'fetch'
              ? generateFetch(endpointUrl || '/api/v1/rest/v1/users', method, JSON.parse(requestHeaders || '{}'), requestBody)
              : generatePython(endpointUrl || '/api/v1/rest/v1/users', method, JSON.parse(requestHeaders || '{}'), requestBody)
          }
          language={playgroundTab === 'curl' ? 'bash' : playgroundTab === 'fetch' ? 'javascript' : 'python'}
          title="Code snippet"
        />
      </div>

      {/* API Endpoints */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">API Endpoints</h2>
        <div className="rounded-xl border border-border bg-card">
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
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{group.table}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{group.endpoints.length} endpoints</span>
                </button>
                <AnimatePresence>
                  {expandedEndpoint === group.table && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-5 pb-3 space-y-2">
                        {group.endpoints.map((ep: any) => (
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
      </div>
    </div>
  );
}