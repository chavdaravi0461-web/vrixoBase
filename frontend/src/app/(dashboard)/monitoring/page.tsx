'use client';

import { useState, useEffect } from 'react';
import {
  Activity, BarChart3, Database, HardDrive, AlertTriangle, Heart,
  Clock, Globe, Server, Zap, Shield, Wifi, WifiOff, ChevronDown,
  RefreshCw
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { PageLoading } from '@/components/common/loading-spinner';
import { cn, formatDateTime } from '@/lib/utils';
import { useDatabaseMetrics, useApiMetrics, useStorageMetrics, useErrors, useHealth, useUsage } from '@/hooks/use-monitoring';
import { useProjectStore } from '@/stores/project-store';
import type { TimeRange } from '@/lib/api/monitoring';

const timeRangeOptions: { label: string; value: TimeRange }[] = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

const PIE_COLORS = ['hsl(187, 100%, 42%)', 'hsl(217, 91%, 60%)', 'hsl(271, 81%, 56%)', 'hsl(160, 84%, 39%)'];

const severityColors = {
  critical: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  error: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  warning: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function MonitoringPage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const { data: dbMetrics, isLoading: dbLoading } = useDatabaseMetrics(projectId ?? '');
  const { data: apiMetrics, isLoading: apiLoading } = useApiMetrics(projectId ?? '');
  const { data: storageMetrics, isLoading: storageLoading } = useStorageMetrics(projectId ?? '');
  const { data: errorsData, isLoading: errorsLoading } = useErrors(projectId ?? '');
  const { data: health, isLoading: healthLoading } = useHealth();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (!isLoading) {
      setLastUpdated(new Date());
    }
  }, [dbLoading, apiLoading, storageLoading, errorsLoading, healthLoading]);

  const isLoading = dbLoading || apiLoading || storageLoading || errorsLoading || healthLoading;

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to view monitoring.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  const errors = errorsData || [];
  const bucketList = storageMetrics?.buckets || [];

  const dbChartData = dbMetrics?.queryCount?.map((p, i) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    queries: p.value,
    connections: dbMetrics.connections[i]?.value || 0,
  })) || [];

  const requestChartData = apiMetrics?.requestsOverTime?.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    requests: p.value,
    errors: 0,
  })) || [];

  const totalApiCalls = apiMetrics?.requestsOverTime?.reduce((s, p) => s + p.value, 0) || 0;
  const totalStorage = storageMetrics?.totalSize || 0;
  const totalFiles = storageMetrics?.totalFiles || 0;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">Metrics, health checks, and error tracking for your project</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
            <span className={cn('h-2 w-2 rounded-full animate-pulse', isLoading ? 'bg-amber-400' : 'bg-emerald-400')} />
            <span className="hidden sm:inline">{isLoading ? 'Updating...' : `Updated ${lastUpdated.toLocaleTimeString()}`}</span>
          </div>
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                timeRange === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Zap, label: 'API Requests', value: totalApiCalls.toLocaleString(), change: '', color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { icon: Database, label: 'DB Queries', value: dbMetrics?.queryCount?.reduce((s, p) => s + p.value, 0).toLocaleString() || '0', change: '', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: HardDrive, label: 'Storage', value: `${(totalStorage / 1073741824).toFixed(2)} GB`, change: `${totalFiles} files`, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { icon: Activity, label: 'Functions', value: '—', change: '', color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('p-2 rounded-lg', metric.bg)}>
                <metric.icon className={cn('h-4 w-4', metric.color)} />
              </div>
              <span className="text-xs text-muted-foreground">{metric.label}</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
            {metric.change && <p className="text-xs mt-1 text-muted-foreground">{metric.change}</p>}
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold">Database Metrics</h2>
          </div>
          <div className="h-[250px]">
            {dbChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dbChartData}>
                  <defs>
                    <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(187, 100%, 42%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(187, 100%, 42%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="queries" stroke="hsl(187, 100%, 42%)" fill="url(#queryGrad)" name="Queries" strokeWidth={2} />
                  <Line type="monotone" dataKey="connections" stroke="hsl(271, 81%, 56%)" name="Connections" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500" /> Queries</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Connections</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold">API Requests</h2>
          </div>
          <div className="h-[250px]">
            {requestChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="requests" fill="hsl(187, 100%, 42%)" radius={[4, 4, 0, 0]} name="Requests" />
                  <Bar dataKey="errors" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold">API Latency</h2>
          </div>
          <div className="h-[250px]">
            {apiMetrics?.latencyByEndpoint ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={apiMetrics.latencyByEndpoint.map((ep) => ({ name: ep.endpoint, ...ep }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="p95" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} name="p95 Latency" />
                  <Line type="monotone" dataKey="p50" stroke="hsl(187, 100%, 42%)" strokeWidth={2} dot={false} name="p50 Latency" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold">Storage Breakdown</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-[200px] w-[200px]">
              {bucketList.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bucketList} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="size" nameKey="name" paddingAngle={3}>
                      {bucketList.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
              )}
            </div>
            <div className="space-y-2">
              {bucketList.map((bucket, idx) => (
                <div key={bucket.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground">{bucket.name}</span>
                  <span className="font-medium">{bucket.fileCount} files</span>
                </div>
              ))}
              {bucketList.length > 0 && (
                <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                  Total: {totalFiles} files · {(totalStorage / 1073741824).toFixed(2)} GB
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold">Recent Errors</h2>
            <span className="ml-auto text-xs text-muted-foreground">{errors.length} errors</span>
          </div>
          <div className="divide-y divide-border">
            {errors.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No errors tracked</div>
            ) : (
              errors.map((err) => (
                <div key={err.id} className="px-5 py-3 flex items-start gap-3">
                  <div className={cn('p-1 rounded', err.severity === 'critical' ? 'bg-rose-500/10' : err.severity === 'error' ? 'bg-amber-500/10' : 'bg-brand-500/10')}>
                    <AlertTriangle className={cn('h-3 w-3', severityColors[err.severity].split(' ')[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{err.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', severityColors[err.severity])}>
                        {err.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{err.source}</span>
                      {err.count > 1 && <span className="text-[10px] text-muted-foreground">x{err.count}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDateTime(err.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Heart className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Health Status</h2>
          </div>
          <div className="p-5 space-y-3">
            {health ? (
              ([
                { key: 'database', label: 'Database' },
                { key: 'redis', label: 'Redis' },
                { key: 'minio', label: 'MinIO Storage' },
                { key: 'backend', label: 'Backend API' },
              ] as const).map((svc) => {
                const status = health[svc.key]?.status || 'unknown';
                return (
                  <div key={svc.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{svc.label}</span>
                    </div>
                    <span className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium',
                      status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                      status === 'degraded' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                    )}>
                      {status === 'healthy' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">Loading health status...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
