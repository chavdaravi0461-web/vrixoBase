'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/components/providers/query-provider';
import { useAuthStore } from '@/stores/auth-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <TooltipProvider delayDuration={200}>
      <QueryProvider>
        {children}
      </QueryProvider>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          },
        }}
      />
    </TooltipProvider>
  );
}
