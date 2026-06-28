'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { FormInput, FormError, LoadingOverlay } from '@/components/auth/auth-form';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to send reset email');
      }

      setSent(true);
      toast.success('Reset link sent to your email');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="relative">
        <LoadingOverlay loading={isLoading} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-xl font-semibold tracking-tight">Reset password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </motion.div>

          <FormError message={error} />

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-6 text-center space-y-2"
            >
              <div className="flex justify-center">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-emerald-500">Check your email</p>
              <p className="text-xs text-muted-foreground">
                We&apos;ve sent a password reset link to <strong>{email}</strong>
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <FormInput
                label="Email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                error={error || undefined}
                autoComplete="email"
                autoFocus
              />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {sent ? (
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center w-full h-10 gap-2 rounded-lg border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            ) : (
              <Button type="submit" className="w-full h-10 gap-2" disabled={isLoading}>
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send reset link
              </Button>
            )}
          </motion.div>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/auth/login"
            className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
