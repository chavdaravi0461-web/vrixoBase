'use client';

import { toast, Toaster } from 'sonner';
import { cn } from '@/lib/utils';

type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
};

function showToast({ title, description, variant = 'default' }: ToastProps) {
  const styles = {
    default: {
      style: {
        background: 'hsl(var(--card))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--border))',
      },
    },
    destructive: {
      style: {
        background: 'hsl(var(--destructive))',
        color: 'hsl(var(--destructive-foreground))',
        border: '1px solid hsl(var(--destructive))',
      },
    },
    success: {
      style: {
        background: '#065f46',
        color: '#f0fdf4',
        border: '1px solid #059669',
      },
    },
    warning: {
      style: {
        background: '#78350f',
        color: '#fefce8',
        border: '1px solid #d97706',
      },
    },
  };

  const config = styles[variant];

  if (description) {
    toast(title, {
      description,
      ...config,
    });
  } else {
    toast(title || '', config);
  }
}

function useToast() {
  return {
    toast: showToast,
    success: (title: string, description?: string) =>
      showToast({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      showToast({ title, description, variant: 'destructive' }),
    warning: (title: string, description?: string) =>
      showToast({ title, description, variant: 'warning' }),
  };
}

export { toast, Toaster, showToast, useToast };
