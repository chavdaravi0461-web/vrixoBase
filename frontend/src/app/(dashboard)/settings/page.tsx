'use client';

import { useState } from 'react';
import {
  Settings2, Shield, Key, Eye, EyeOff, Plus, Trash2, X, Check,
  Gauge, AlertTriangle, Globe, Mail, Github, Save, RefreshCw,
  Copy, ExternalLink, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn, formatDate } from '@/lib/utils';
import { useSecrets, useCreateSecret, useDeleteSecret } from '@/hooks/use-security';
import { useUpdateProject } from '@/hooks/use-projects';
import { useProjectStore } from '@/stores/project-store';

const MOCK_PROVIDERS = [
  { id: 'email', name: 'Email & Password', icon: Mail, enabled: true },
  { id: 'google', name: 'Google', icon: Globe, enabled: true },
  { id: 'github', name: 'GitHub', icon: Github, enabled: false },
];

export default function SettingsPage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const currentProject = useProjectStore((s) => s.currentProject);

  const { data: secretsData, isLoading: secretsLoading } = useSecrets(projectId ?? '');
  const createSecret = useCreateSecret(projectId ?? '');
  const deleteSecret = useDeleteSecret(projectId ?? '');
  const updateProject = useUpdateProject();

  const secrets = secretsData || [];

  const [tab, setTab] = useState<'general' | 'auth' | 'security' | 'secrets' | 'rate' | 'danger'>('general');

  const [projectName, setProjectName] = useState(currentProject?.name || 'My Project');
  const [projectDesc, setProjectDesc] = useState(currentProject?.description || '');
  const [projectSlug, setProjectSlug] = useState(currentProject?.slug || '');
  const [providers, setProviders] = useState(MOCK_PROVIDERS);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [redirectUrls, setRedirectUrls] = useState('http://localhost:3000/auth/callback\nhttps://myapp.com/auth/callback');

  const handleSaveGeneral = () => {
    if (!projectId) return;
    updateProject.mutate({ id: projectId, name: projectName, description: projectDesc }, {
      onSuccess: () => toast.success('General settings saved'),
      onError: (err) => toast.error(err.message),
    });
  };

  const toggleProvider = (id: string) => {
    setProviders((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleAddSecret = () => {
    if (!newSecretName.trim() || !newSecretValue.trim()) { toast.error('Fill in all fields'); return; }
    createSecret.mutate({ name: newSecretName.trim(), value: newSecretValue.trim() }, {
      onSuccess: () => {
        setNewSecretName('');
        setNewSecretValue('');
        setShowAddSecret(false);
        toast.success('Secret added');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleRemoveSecret = (id: string) => {
    deleteSecret.mutate(id, {
      onSuccess: () => toast.success('Secret removed'),
      onError: (err) => toast.error(err.message),
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Settings2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to manage settings.</p>
      </div>
    );
  }

  if (secretsLoading) return <PageLoading />;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your project configuration</p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit flex-wrap">
        {(['general', 'auth', 'security', 'secrets', 'rate', 'danger'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'general' ? 'General' : t === 'auth' ? 'Authentication' : t === 'security' ? 'Security' : t === 'secrets' ? 'Secrets' : t === 'rate' ? 'Rate Limiting' : 'Danger Zone'}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold">Project Information</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Name</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
              <textarea value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Slug</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">vrixo.app/</span>
                  <input type="text" value={projectSlug} onChange={(e) => setProjectSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="w-full pl-[72px] pr-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono" />
                </div>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={handleSaveGeneral} disabled={updateProject.isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                <Save className="h-4 w-4" /> {updateProject.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'auth' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold">Authentication Providers</h2>
            <div className="space-y-3">
              {providers.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', p.enabled ? 'bg-brand-500/10' : 'bg-muted/50')}>
                      <p.icon className={cn('h-4 w-4', p.enabled ? 'text-brand-400' : 'text-muted-foreground')} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.enabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleProvider(p.id)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      p.enabled ? 'bg-brand-500' : 'bg-muted'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      p.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold">Redirect URLs</h2>
            <p className="text-xs text-muted-foreground">OAuth redirect URLs for authentication callbacks</p>
            <textarea
              value={redirectUrls}
              onChange={(e) => setRedirectUrls(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
            <button onClick={() => toast.success('Auth settings saved')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </motion.div>
      )}

      {tab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-brand-400" />
              <h2 className="text-base font-semibold">Row Level Security (RLS)</h2>
            </div>
            <p className="text-xs text-muted-foreground">RLS policies control access to your database tables at the row level.</p>
            <div className="space-y-2">
              {['users (ENABLED)', 'products (ENABLED)', 'orders (ENABLED)', 'reviews (DISABLED)'].map((policy) => (
                <div key={policy} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <span className="text-sm font-mono">{policy.split(' (')[0]}</span>
                  <span className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full',
                    policy.includes('ENABLED') ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground bg-muted/50'
                  )}>
                    {policy.includes('ENABLED') ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
            <button className="text-xs text-brand-400 hover:underline">Manage RLS Policies →</button>
          </div>
        </motion.div>
      )}

      {tab === 'secrets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-brand-400" />
                <h2 className="text-base font-semibold">Encrypted Secrets</h2>
              </div>
              <button
                onClick={() => setShowAddSecret(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Secret
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Secrets are encrypted at rest and injected as environment variables into functions.</p>
            <div className="space-y-2">
              {secrets.map((secret) => (
                <div key={secret.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <code className="text-sm font-mono text-amber-400">{secret.name}</code>
                      <p className="text-[10px] text-muted-foreground">Updated {formatDate(secret.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRevealedSecrets((prev) => {
                        const next = new Set(prev);
                        if (next.has(secret.id)) next.delete(secret.id); else next.add(secret.id);
                        return next;
                      })}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      {revealedSecrets.has(secret.id) ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => handleRemoveSecret(secret.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {secrets.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No secrets configured</p>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showAddSecret && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Add Secret</h3>
                    <button onClick={() => setShowAddSecret(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                      <input type="text" value={newSecretName} onChange={(e) => setNewSecretName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="MY_SECRET_KEY" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Value</label>
                      <input type="password" value={newSecretValue} onChange={(e) => setNewSecretValue(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <button onClick={() => setShowAddSecret(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={handleAddSecret} disabled={createSecret.isPending} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                      {createSecret.isPending ? 'Adding...' : 'Add Secret'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {tab === 'rate' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-5 w-5 text-brand-400" />
              <h2 className="text-base font-semibold">Rate Limiting</h2>
            </div>
            <p className="text-xs text-muted-foreground">Configure API rate limits to protect your backend.</p>
            <div className="space-y-3">
              {[
                { label: 'REST API Requests', value: '100', unit: 'req/min', desc: 'Per IP address' },
                { label: 'Auth Endpoints', value: '20', unit: 'req/min', desc: 'Login, register, password reset' },
                { label: 'File Uploads', value: '10', unit: 'req/min', desc: 'Per user' },
                { label: 'GraphQL Queries', value: '50', unit: 'req/min', desc: 'Per IP address' },
              ].map((limit) => (
                <div key={limit.label} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">{limit.label}</p>
                    <p className="text-xs text-muted-foreground">{limit.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      defaultValue={limit.value}
                      className="w-16 px-2 py-1 rounded border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <span className="text-xs text-muted-foreground">{limit.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => toast.success('Rate limits saved')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
              <Save className="h-4 w-4" /> Save Limits
            </button>
          </div>
        </motion.div>
      )}

      {tab === 'danger' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
          <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Irreversible actions that will affect your entire project. Proceed with caution.
            </p>

            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Project</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently delete your project and all its data. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Delete Project
                </button>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Export Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download a full backup of your project data including database, storage, and configuration.
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>
            </div>
          </div>

          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
            onConfirm={() => { toast.error('This is a demo — project deletion is simulated'); setShowDeleteConfirm(false); }}
            title="Delete Project"
            description="This will permanently delete your project, all databases, stored files, functions, and configurations. This action cannot be undone. Are you absolutely sure?"
            confirmText="I understand, delete everything"
            variant="destructive"
          />
        </motion.div>
      )}
    </div>
  );
}
