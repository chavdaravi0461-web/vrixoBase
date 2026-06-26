'use client';

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  multiple?: boolean;
  disabled?: boolean;
}

export function FileUpload({
  onFilesSelected,
  accept,
  maxFiles = 10,
  maxSizeMB = 50,
  multiple = true,
  disabled = false,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (files: FileList | File[]): File[] => {
    const arr = Array.from(files);
    setError(null);

    if (arr.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return [];
    }

    const oversized = arr.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (oversized) {
      setError(`File "${oversized.name}" exceeds ${maxSizeMB}MB limit`);
      return [];
    }

    if (accept) {
      const exts = accept.split(',').map((e) => e.trim().toLowerCase());
      const invalid = arr.find((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return !exts.includes(ext) && !exts.includes(f.type);
      });
      if (invalid) {
        setError(`File type not accepted: ${invalid.name}`);
        return [];
      }
    }

    return arr;
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = validate(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = validate(e.target.files);
      if (files.length > 0) onFilesSelected(files);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={cn(
          'relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer',
          dragging
            ? 'border-brand-400 bg-brand-500/5'
            : 'border-border hover:border-muted-foreground/30 bg-card/30',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        <motion.div
          animate={dragging ? { scale: 1.1 } : { scale: 1 }}
          className={cn(
            'p-3 rounded-full mb-3',
            dragging ? 'bg-brand-500/20' : 'bg-muted/50'
          )}
        >
          <Upload className={cn('h-6 w-6', dragging ? 'text-brand-400' : 'text-muted-foreground')} />
        </motion.div>
        <p className="text-sm font-medium text-foreground">
          {dragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Up to {maxFiles} files, {maxSizeMB}MB each
          {accept && ` (${accept})`}
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto hover:text-destructive/80">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
