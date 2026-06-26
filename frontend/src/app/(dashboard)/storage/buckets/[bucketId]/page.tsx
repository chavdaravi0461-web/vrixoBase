'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  File, FileText, Image, Video, Archive, Folder, FolderPlus,
  Upload, Download, Link, Trash2, Clock, Grid3X3, List, ChevronRight,
  Home, ArrowLeft, X, Search, FileUp, ExternalLink, Lock, Check, Copy,
  Timer, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { FileUpload } from '@/components/common/file-upload';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn, formatBytes, formatDateTime, formatDate } from '@/lib/utils';
import { useFiles, useUploadFile, useDeleteFile, useCreateFolder } from '@/hooks/use-storage';
import type { StorageFile } from '@/lib/api/storage';

const fileIconMap: Record<string, React.ReactNode> = {
  'image/jpeg': <Image className="h-8 w-8 text-emerald-400" />,
  'image/png': <Image className="h-8 w-8 text-emerald-400" />,
  'image/gif': <Image className="h-8 w-8 text-emerald-400" />,
  'image/webp': <Image className="h-8 w-8 text-emerald-400" />,
  'application/pdf': <FileText className="h-8 w-8 text-rose-400" />,
  'application/zip': <Archive className="h-8 w-8 text-amber-400" />,
  'video/mp4': <Video className="h-8 w-8 text-violet-400" />,
  'text/javascript': <FileText className="h-8 w-8 text-amber-400" />,
  'text/css': <FileText className="h-8 w-8 text-blue-400" />,
  'folder': <Folder className="h-8 w-8 text-brand-400" />,
};

const isImage = (mime: string) => mime.startsWith('image/');

export default function BucketPage() {
  const params = useParams();
  const bucketId = params.bucketId as string;

  const { data: files, isLoading, refetch } = useFiles(bucketId);
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();
  const createFolder = useCreateFolder();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [signedUrlFile, setSignedUrlFile] = useState<StorageFile | null>(null);
  const [signedUrlExpiry, setSignedUrlExpiry] = useState(3600);
  const [signedUrlResult, setSignedUrlResult] = useState<string | null>(null);
  const [signedUrlCopied, setSignedUrlCopied] = useState(false);
  const [generatingUrl, setGeneratingUrl] = useState(false);

  const fileList = files || [];

  const handleUpload = (uploadedFiles: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    let completed = 0;
    uploadedFiles.forEach((file) => {
      uploadFile.mutate({ bucketId, file, isPublic: false }, {
        onSuccess: () => {
          completed++;
          setUploadProgress(Math.round((completed / uploadedFiles.length) * 100));
          if (completed === uploadedFiles.length) {
            setUploading(false);
            setShowUpload(false);
            toast.success(`${uploadedFiles.length} file(s) uploaded`);
            refetch();
          }
        },
        onError: (err) => {
          completed++;
          toast.error(err.message);
          if (completed === uploadedFiles.length) {
            setUploading(false);
            setShowUpload(false);
          }
        },
      });
    });
  };

  const handleCreateFolder = () => {
    if (!folderName.trim()) { toast.error('Enter a folder name'); return; }
    createFolder.mutate({ bucketId, path: folderName.trim() }, {
      onSuccess: () => {
        toast.success(`Folder "${folderName}" created`);
        setShowCreateFolder(false);
        setFolderName('');
        refetch();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleCopyUrl = async (file: StorageFile) => {
    try {
      await navigator.clipboard.writeText(file.url || `https://storage.vrixobase.com/${bucketId}/${file.name}`);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('URL copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleGenerateSignedUrl = useCallback(async () => {
    if (!signedUrlFile) return;
    setGeneratingUrl(true);
    setSignedUrlResult(null);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vrixo_access_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/api/storage/${bucketId}/signed-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          path: signedUrlFile.name,
          expiresIn: signedUrlExpiry,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Failed to generate signed URL');
      }

      const data = await res.json();
      const url = data.url || data.data?.url || `${apiBase}/api/storage/${bucketId}/files/${encodeURIComponent(signedUrlFile.name)}?token=${token || 'public'}&expires=${Date.now() + signedUrlExpiry * 1000}`;
      setSignedUrlResult(url);
      setSignedUrlCopied(false);
      toast.success('Signed URL generated');
    } catch (err: any) {
      const fallbackUrl = `${apiBase}/api/storage/${bucketId}/files/${encodeURIComponent(signedUrlFile.name)}`;
      setSignedUrlResult(fallbackUrl);
      toast.warning(err.message || 'Could not generate signed URL, showing public URL instead');
    }

    setGeneratingUrl(false);
  }, [signedUrlFile, bucketId, signedUrlExpiry]);

  const handleCopySignedUrl = async () => {
    if (!signedUrlResult) return;
    try {
      await navigator.clipboard.writeText(signedUrlResult);
      setSignedUrlCopied(true);
      setTimeout(() => setSignedUrlCopied(false), 2000);
      toast.success('Signed URL copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteFile.mutate(deleteId, {
      onSuccess: () => {
        toast.success('File deleted');
        setDeleteId(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const filtered = fileList.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => window.history.back()} className="p-1 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Home className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Storage</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{bucketId}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={cn('p-2', viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={cn('p-2', viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => { setFolderName(''); setShowCreateFolder(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
            <FolderPlus className="h-4 w-4" /> Folder
          </button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </div>

      {uploading && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-brand-400 animate-pulse" />
              <span className="text-sm font-medium">Uploading...</span>
            </div>
            <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-blue"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border">
          <Folder className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">This bucket is empty</h3>
          <p className="text-sm text-muted-foreground mb-4">Upload your first file or create a folder</p>
          <div className="flex gap-2">
            <button onClick={() => setShowCreateFolder(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              <FolderPlus className="h-4 w-4" /> New Folder
            </button>
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
              <Upload className="h-4 w-4" /> Upload Files
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((file, idx) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.03 }}
              className="group relative rounded-xl border border-border bg-card p-4 hover:border-brand-500/30 transition-all cursor-pointer"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3">
                  {file.isFolder ? fileIconMap['folder'] : fileIconMap[file.mimeType] || <File className="h-8 w-8 text-muted-foreground" />}
                </div>
                <p className="text-xs font-medium truncate w-full">{file.name}</p>
                {!file.isFolder && <p className="text-[10px] text-muted-foreground mt-1">{formatBytes(file.size)}</p>}
                <p className="text-[10px] text-muted-foreground">{formatDate(file.createdAt)}</p>
              </div>
              {!file.isFolder && (
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-card/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  {isImage(file.mimeType) && (
                    <button onClick={() => setPreviewFile(file)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Image className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleCopyUrl(file)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    {copiedId === file.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => { setSignedUrlFile(file); setSignedUrlResult(null); setSignedUrlExpiry(3600); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(file.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Size</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Uploaded</th>
                <th className="px-4 py-3 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((file) => (
                <tr key={file.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {file.isFolder ? fileIconMap['folder'] : fileIconMap[file.mimeType] || <File className="h-5 w-5 text-muted-foreground" />}
                      <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{file.isFolder ? 'Folder' : file.mimeType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{file.isFolder ? '-' : formatBytes(file.size)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{formatDateTime(file.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!file.isFolder && (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isImage(file.mimeType) && (
                          <button onClick={() => setPreviewFile(file)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <Image className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleCopyUrl(file)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Link className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setSignedUrlFile(file); setSignedUrlResult(null); setSignedUrlExpiry(3600); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(file.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Upload Files</h3>
                <button onClick={() => setShowUpload(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <FileUpload onFilesSelected={handleUpload} maxFiles={20} maxSizeMB={100} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateFolder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Create Folder</h3>
                <button onClick={() => setShowCreateFolder(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="folder-name"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowCreateFolder(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleCreateFolder} disabled={createFolder.isPending} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative max-w-2xl mx-4">
              <button onClick={() => setPreviewFile(null)} className="absolute -top-3 -right-3 p-1.5 rounded-full bg-card border border-border shadow-lg hover:bg-muted z-10">
                <X className="h-4 w-4" />
              </button>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                  <Image className="h-16 w-16 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium mt-3">{previewFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(previewFile.size)}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {signedUrlFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <h3 className="text-lg font-semibold">Generate Signed URL</h3>
                </div>
                <button onClick={() => setSignedUrlFile(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground">File</p>
                  <p className="text-sm font-medium mt-0.5 truncate">{signedUrlFile.name}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Timer className="h-3 w-3" /> Expiry Duration
                  </label>
                  <select
                    value={signedUrlExpiry}
                    onChange={(e) => setSignedUrlExpiry(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={3600}>1 hour</option>
                    <option value={86400}>24 hours</option>
                    <option value={604800}>7 days</option>
                    <option value={2592000}>30 days</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateSignedUrl}
                  disabled={generatingUrl}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {generatingUrl ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  {generatingUrl ? 'Generating...' : 'Generate Signed URL'}
                </button>

                {signedUrlResult && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <Link className="h-3.5 w-3.5" />
                      Signed URL ready
                    </div>
                    <div className="flex gap-2">
                      <code className="flex-1 p-2 rounded bg-black/40 text-[11px] font-mono text-emerald-300 break-all max-h-20 overflow-y-auto">
                        {signedUrlResult}
                      </code>
                      <button onClick={handleCopySignedUrl} className="p-2 rounded border border-border hover:bg-muted shrink-0">
                        {signedUrlCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Expires in {signedUrlExpiry >= 86400 ? `${signedUrlExpiry / 86400}d` : signedUrlExpiry >= 3600 ? `${signedUrlExpiry / 3600}h` : `${signedUrlExpiry / 60}m`}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete File" description="This will permanently delete the file. This action cannot be undone." confirmText="Delete" variant="destructive" />
    </div>
  );
}
