'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 text-center px-4"
      >
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10">
          <Hexagon className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            An unexpected error occurred. Please try again.
          </p>
        </div>
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </motion.div>
    </div>
  );
}
