'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HardDrive, Plus, Lock, Globe, File, Trash2,
  X, ChevronRight, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { useBuckets, useCreateBucket, useDeleteBucket } from '@/hooks/use-storage';
import { useProjectStore } from '@/stores/project-store';
import type { Bucket } from '@/lib/api/storage';

export default function StoragePage() {
  const router = useRouter();
  const projectId = useProjectStore((s) => s.currentProject?.id);

  const { data: buckets, isLoading, refetch } = useBuckets(projectId ?? '');
  const createBucket = useCreateBucket(projectId ?? '');
  const deleteBucket = useDeleteBucket();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [newMimeTypes, setNewMimeTypes] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) { toast.error('Enter a bucket name'); return; }
    createBucket.mutate({
      name: newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
      isPublic: newPublic,
      allowedMimeTypes: newMimeTypes ? newMimeTypes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    }, {
      onSuccess: () => {
        toast.success(`Bucket "${newName}" created`);
        setShowCreate(false);
        setNewName('');
        setNewPublic(false);
        setNewMimeTypes('');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteBucket.mutate(deleteId, {
      onSuccess: () => { toast.success('Bucket deleted'); setDeleteId(null); },
      onError: (err) => toast.error(err.message),
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HardDrive className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to manage storage.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  const bucketList = buckets || [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage file buckets and assets</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Bucket
          </button>
        </div>
      </div>

      {bucketList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border">
          <HardDrive className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">No buckets yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first storage bucket to start uploading files</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Bucket
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bucketList.map((bucket, idx) => {
            const fileCount = bucket.fileCount ?? bucket._count?.files ?? 0;
            const totalSize = bucket.totalSize ?? 0;
            return (
              <motion.button
                key={bucket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => router.push(`/storage/buckets/${bucket.id}`)}
                className="group relative text-left rounded-xl border border-border bg-card p-5 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    'p-2.5 rounded-lg',
                    bucket.isPublic ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  )}>
                    <HardDrive className={cn('h-5 w-5', bucket.isPublic ? 'text-emerald-400' : 'text-amber-400')} />
                  </div>
                  <span className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                    bucket.isPublic
                      ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                      : 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                  )}>
                    {bucket.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {bucket.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <h3 className="text-sm font-semibold mb-1 truncate group-hover:text-brand-400 transition-colors">{bucket.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{formatBytes(totalSize)}</p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <File className="h-3 w-3" />
                    {fileCount} files
                  </div>
                  <span>{formatDate(bucket.createdAt)}</span>
                </div>
                <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Create Bucket</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bucket Name</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="my-bucket" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">Public Bucket</p>
                    <p className="text-xs text-muted-foreground">Files are publicly accessible</p>
                  </div>
                  <button
                    onClick={() => setNewPublic(!newPublic)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      newPublic ? 'bg-brand-500' : 'bg-muted'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      newPublic ? 'translate-x-5' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Allowed MIME Types (comma separated)</label>
                  <input type="text" value={newMimeTypes} onChange={(e) => setNewMimeTypes(e.target.value)} placeholder="image/*, application/pdf" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={createBucket.isPending} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">{createBucket.isPending ? 'Creating...' : 'Create Bucket'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Bucket"
        description="This will permanently delete the bucket and all its files. This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
