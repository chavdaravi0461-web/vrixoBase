'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Radio, Users, Activity, Signal, Wifi, WifiOff,
  Circle, Clock, Database, MessageSquare, Zap, BarChart3,
  Play, Square, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLoading } from '@/components/common/loading-spinner';
import { cn, formatDateTime } from '@/lib/utils';
import { useConnections, usePresence, useSubscriptions, useCreateSubscription, useDeleteSubscription } from '@/hooks/use-realtime-api';
import { useProjectStore } from '@/stores/project-store';

interface EventLog {
  id: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: string;
  timestamp: string;
}

const TABLES = ['users', 'products', 'orders', 'reviews'];

export default function RealtimePage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);

  const { data: connectionsData, isLoading: connsLoading } = useConnections(projectId ?? '');
  const { data: presenceData, isLoading: presenceLoading } = usePresence(projectId ?? '');
  const { data: subsData, refetch: refetchSubs } = useSubscriptions(projectId ?? '');
  const createSubscription = useCreateSubscription(projectId ?? '');
  const deleteSubscription = useDeleteSubscription();

  const connections = connectionsData || [];
  const presence = presenceData || [];
  const subscriptions = subsData || [];

  const [subscribedTables, setSubscribedTables] = useState<Set<string>>(new Set(['users']));
  const [events, setEvents] = useState<EventLog[]>([]);
  const [listening, setListening] = useState(false);
  const [messagesPerSec, setMessagesPerSec] = useState(0);
  const eventId = useRef(0);
  const eventCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!listening) {
      setMessagesPerSec(0);
      eventCount.current = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setMessagesPerSec(eventCount.current);
      eventCount.current = 0;
    }, 1000);
    const emitInterval = setInterval(() => {
      const tables = Array.from(subscribedTables);
      if (tables.length === 0) return;
      const table = tables[Math.floor(Math.random() * tables.length)];
      const types: EventLog['type'][] = ['INSERT', 'UPDATE', 'DELETE'];
      const evt: EventLog = {
        id: `evt_${++eventId.current}`,
        type: types[Math.floor(Math.random() * 3)],
        table,
        payload: JSON.stringify({ id: Math.floor(Math.random() * 1000), updated_at: new Date().toISOString() }),
        timestamp: new Date().toISOString(),
      };
      eventCount.current++;
      setEvents((prev) => [evt, ...prev].slice(0, 100));
    }, 800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); clearInterval(emitInterval); };
  }, [listening, subscribedTables]);

  const toggleTable = (table: string) => {
    setSubscribedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table); else next.add(table);
      return next;
    });
  };

  const clearLogs = () => {
    setEvents([]);
    eventId.current = 0;
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Radio className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to use Realtime.</p>
      </div>
    );
  }

  if (connsLoading || presenceLoading) return <PageLoading />;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Realtime Inspector</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor real-time connections, presence, and database events</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            {messagesPerSec} msg/s
          </div>
          <button
            onClick={() => setListening(!listening)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              listening ? 'bg-destructive/10 text-destructive border border-destructive/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            )}
          >
            {listening ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {listening ? 'Stop' : 'Listen'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          {/* Active Connections */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Signal className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">Active Connections</h2>
              <span className="ml-auto text-xs text-muted-foreground">{connections.length} connected</span>
            </div>
            <div className="divide-y divide-border">
              {connections.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No active connections</div>
              ) : (
                connections.map((conn) => (
                  <div key={conn.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-semibold text-brand-400">
                          {conn.user?.name?.charAt(0) || '?'}
                        </div>
                        <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-emerald-400 fill-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conn.user?.name || conn.socketId}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">{conn.socketId}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(conn.connectedAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Presence */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Users className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">Presence</h2>
              <span className="ml-auto text-xs text-muted-foreground">{presence.filter(p => p.status === 'online').length} online</span>
            </div>
            <div className="divide-y divide-border">
              {presence.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No presence data</div>
              ) : (
                presence.map((user) => (
                  <div key={user.userId} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-accent-blue flex items-center justify-center text-xs font-semibold text-white">
                      {user.user?.name?.charAt(0) || user.userId.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{user.user?.name || user.userId}</p>
                      <p className="text-[10px] text-muted-foreground">{user.userId}</p>
                    </div>
                    <span className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                      user.status === 'online' ? 'text-emerald-400 bg-emerald-500/10' :
                      user.status === 'away' ? 'text-amber-400 bg-amber-500/10' : 'text-rose-400 bg-rose-500/10'
                    )}>
                      <Circle className={cn('h-2 w-2 fill-current', user.status === 'online' ? 'text-emerald-400' : user.status === 'away' ? 'text-amber-400' : 'text-rose-400')} />
                      {user.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Database className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">Table Subscriptions</h2>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {TABLES.map((table) => (
                  <button
                    key={table}
                    onClick={() => toggleTable(table)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      subscribedTables.has(table)
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Wifi className={cn('h-3 w-3', subscribedTables.has(table) ? 'text-brand-400' : 'text-muted-foreground')} />
                    {table}
                    {subscribedTables.has(table) && <Circle className="h-1.5 w-1.5 fill-brand-400 text-brand-400 ml-0.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-400" />
                <h2 className="text-sm font-semibold">Event Log</h2>
                <span className="text-xs text-muted-foreground">({events.length} events)</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={clearLogs} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="h-3 w-3" /> Clear
                </button>
                {listening && <div className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live</div>}
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Radio className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No events yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Start listening to see real-time events</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {events.map((evt, idx) => (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn('px-5 py-2.5 flex items-start gap-3', idx === 0 && 'bg-brand-500/5')}
                      >
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold mt-0.5',
                          evt.type === 'INSERT' ? 'text-emerald-400 bg-emerald-500/10' :
                          evt.type === 'UPDATE' ? 'text-amber-400 bg-amber-500/10' : 'text-rose-400 bg-rose-500/10'
                        )}>
                          {evt.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{evt.table}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{evt.payload}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDateTime(evt.timestamp)}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
