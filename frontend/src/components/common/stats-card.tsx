'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    positive?: boolean;
  };
  iconColor?: string;
  className?: string;
}

export function StatsCard({
  icon: Icon,
  label,
  value,
  description,
  trend,
  iconColor,
  className,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-5 hover:border-border/80 transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
            iconColor || 'bg-primary/10'
          )}
        >
          <Icon
            className={cn('h-5 w-5', iconColor ? 'text-white' : 'text-primary')}
          />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {trend.positive !== false ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              trend.positive !== false ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {trend.value}%
          </span>
          <span className="text-xs text-muted-foreground">vs last month</span>
        </div>
      )}
    </motion.div>
  );
}
