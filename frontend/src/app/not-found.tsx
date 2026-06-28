'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Hexagon, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 text-center px-4"
      >
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <Hexagon className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">404</h1>
          <p className="text-lg text-muted-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            Go home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
