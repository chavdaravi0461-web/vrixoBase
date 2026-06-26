'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Hexagon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');

      if (!accessToken || !refreshToken) {
        setError('Missing authentication tokens');
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!res.ok) throw new Error('Failed to fetch user data');

        const user = await res.json();
        login(user, accessToken, refreshToken);
        router.push('/dashboard');
      } catch {
        setError('Authentication failed');
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    };

    handleCallback();
  }, [router, login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        {error ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mx-auto">
              <Hexagon className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-destructive font-medium">{error}</p>
            <p className="text-xs text-muted-foreground">Redirecting to login...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
            <p className="text-sm font-medium">Completing authentication...</p>
            <p className="text-xs text-muted-foreground">Please wait while we sign you in</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
