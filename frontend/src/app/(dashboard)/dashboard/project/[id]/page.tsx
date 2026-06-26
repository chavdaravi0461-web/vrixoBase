'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Database,
  Cable,
  HardDrive,
  FunctionSquare,
  Activity,
  Users,
  Clock,
  Code,
  TrendingUp,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/common/page-header';
import { StatsCard } from '@/components/common/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/stores/project-store';
import { formatNumber, timeAgo, getInitials } from '@/lib/utils';
import type { DashboardProject } from '@/types/project';

const usageData = [
  { name: 'Mon', apiCalls: 2400, queries: 1398, bandwidth: 800 },
  { name: 'Tue', apiCalls: 1398, queries: 3800, bandwidth: 1200 },
  { name: 'Wed', apiCalls: 9800, queries: 2400, bandwidth: 2400 },
  { name: 'Thu', apiCalls: 3908, queries: 2400, bandwidth: 1800 },
  { name: 'Fri', apiCalls: 4800, queries: 2400, bandwidth: 2800 },
  { name: 'Sat', apiCalls: 3800, queries: 1400, bandwidth: 1600 },
  { name: 'Sun', apiCalls: 4300, queries: 2200, bandwidth: 2000 },
];

const recentQueries = [
  {
    id: '1',
    query: 'SELECT * FROM users WHERE status = ? LIMIT 50',
    duration: '12ms',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    status: 'success',
  },
  {
    id: '2',
    query: 'INSERT INTO orders (user_id, total) VALUES (?, ?)',
    duration: '8ms',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    status: 'success',
  },
  {
    id: '3',
    query: 'UPDATE products SET stock = stock - ? WHERE id = ?',
    duration: '45ms',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    status: 'success',
  },
  {
    id: '4',
    query: 'SELECT p.*, c.name FROM products p JOIN categories c ON p.category_id = c.id',
    duration: '120ms',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'success',
  },
];

const quickActions = [
  { label: 'Database', icon: Database, href: '/database', color: 'text-emerald-400 bg-emerald-500/10' },
  { label: 'API', icon: Cable, href: '/api', color: 'text-blue-400 bg-blue-500/10' },
  { label: 'Storage', icon: HardDrive, href: '/storage', color: 'text-amber-400 bg-amber-500/10' },
  { label: 'Functions', icon: FunctionSquare, href: '/functions', color: 'text-violet-400 bg-violet-500/10' },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { projects, updateProject } = useProjectStore();
  const [project, setProject] = useState<DashboardProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const found = projects.find((p) => p.id === params.id);
    if (found) {
      setProject(found);
      setIsLoading(false);
    } else {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [params.id, projects]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Project not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                <Badge variant={project.status === 'active' ? 'success' : 'warning'}>
                  {project.status}
                </Badge>
                <Badge variant={project.plan === 'pro' ? 'default' : 'secondary'}>
                  {project.plan}
                </Badge>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
              )}
            </div>
          </div>
        }
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem>
                <Play className="mr-2 h-4 w-4" />
                Enable
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        <StatsCard
          icon={Cable}
          label="API Calls"
          value={formatNumber(project.stats.apiCalls)}
          description="Total this month"
          trend={{ value: 15, positive: true }}
        />
        <StatsCard
          icon={Database}
          label="Database Queries"
          value={formatNumber(project.stats.databaseQueries)}
          description="Total this month"
          trend={{ value: 8, positive: true }}
        />
        <StatsCard
          icon={HardDrive}
          label="Storage"
          value={`${(project.stats.storageUsed / 1073741824).toFixed(2)} GB`}
          description={`of ${(project.stats.storageLimit / 1073741824).toFixed(1)} GB`}
          trend={{ value: 5, positive: true }}
        />
        <StatsCard
          icon={FunctionSquare}
          label="Functions"
          value={project.stats.functionsCount}
          description="Deployed"
          trend={{ value: 0, positive: true }}
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
                onClick={() => router.push(`${action.href}?projectId=${params.id}`)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-4 hover:border-primary/30 hover:bg-card transition-all duration-200"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${action.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              API Calls & Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageData}>
                  <defs>
                    <linearGradient id="apiCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="queries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatNumber(v)}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="apiCalls"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#apiCalls)"
                  />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#queries)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Bandwidth Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}GB`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bandwidth"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Queries + Team */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        {/* Recent Queries */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" />
              Recent Queries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {recentQueries.map((q) => (
                <div key={q.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      {q.query}
                    </code>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{q.duration}</span>
                      <span className="text-xs text-emerald-400">OK</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{timeAgo(q.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {project.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-muted">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <Badge
                    variant={member.role === 'owner' ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border/50">
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Invite Members
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
