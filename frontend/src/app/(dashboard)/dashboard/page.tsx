'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus,
  Database,
  Cable,
  HardDrive,
  Activity,
  Users,
  ArrowRight,
  Clock,
  Code,
  Server,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { StatsCard } from '@/components/common/stats-card';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { PageLoading } from '@/components/common/loading-spinner';
import { useAuthStore } from '@/stores/auth-store';
import { useProjectStore } from '@/stores/project-store';
import { useProjects } from '@/hooks/use-projects';
import { CreateProjectDialog } from '@/components/dashboard/create-project-dialog';
import { formatNumber, timeAgo, getInitials } from '@/lib/utils';
import type { RecentActivity } from '@/types/project';

const activityIcons = {
  api_call: Cable,
  query: Database,
  deploy: Code,
  member: Users,
  setting: Server,
} as const;

const planBadgeVariant = {
  free: 'secondary' as const,
  pro: 'default' as const,
  team: 'info' as const,
  enterprise: 'success' as const,
};

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { setCurrentProject } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: projects, isLoading, error } = useProjects();

  const [activity] = useState<RecentActivity[]>([]);

  const projectList = projects || [];

  const totalApiCalls = projectList.reduce((sum, p) => sum + (p.stats?.apiCalls || 0), 0);
  const totalStorage = projectList.reduce((sum, p) => sum + (p.stats?.storageUsed || 0), 0);
  const totalQueries = projectList.reduce((sum, p) => sum + (p.stats?.databaseQueries || 0), 0);
  const totalFunctions = projectList.reduce((sum, p) => sum + (p.stats?.functionsCount || 0), 0);

  const handleProjectClick = (project: any) => {
    setCurrentProject(project);
    router.push(`/database`);
  };

  if (isLoading) return <PageLoading />;
  if (error) return <div className="text-destructive text-sm p-4">Failed to load projects.</div>;

  return (
    <>
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PageHeader
          title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
          description="Here's an overview of your projects and usage"
          actions={
            <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          }
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        <StatsCard
          icon={Cable}
          label="API Calls"
          value={formatNumber(totalApiCalls)}
          description="Total across all projects"
          trend={{ value: 0, positive: true }}
        />
        <StatsCard
          icon={HardDrive}
          label="Storage"
          value={`${(totalStorage / 1073741824).toFixed(1)} GB`}
          description={`of ${(projectList.reduce((s, p) => s + (p.stats?.storageLimit || 0), 0) / 1073741824).toFixed(1)} GB used`}
          trend={{ value: 0, positive: true }}
        />
        <StatsCard
          icon={Database}
          label="Database Queries"
          value={formatNumber(totalQueries)}
          description="Total queries today"
          trend={{ value: 0, positive: false }}
        />
        <StatsCard
          icon={Activity}
          label="Functions"
          value={totalFunctions}
          description="Deployed functions"
          trend={{ value: 0, positive: true }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs">
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {projectList.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No projects yet"
            description="Create your first project to get started with VrixoBase."
            actionLabel="Create Project"
            onAction={() => setShowCreateDialog(true)}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projectList.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
              >
                <Card
                  className="group cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => handleProjectClick(project)}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </CardTitle>
                        {project.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={planBadgeVariant[project.plan as keyof typeof planBadgeVariant] || 'secondary'} className="shrink-0 ml-2">
                        {project.plan}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-2">
                    <div className="flex items-center gap-1 mb-3">
                      <Badge
                        variant={project.status === 'active' ? 'success' : 'warning'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {project.status}
                      </Badge>
                      <div className="flex -space-x-2 ml-auto">
                        {(project.members || []).slice(0, 3).map((member: any) => (
                          <Avatar key={member.id} className="h-6 w-6 border-2 border-card">
                            <AvatarImage src={member.avatar_url || ''} />
                            <AvatarFallback className="text-[8px] bg-muted">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {(project.members || []).length > 3 && (
                          <div className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[8px] text-muted-foreground font-medium">
                            +{(project.members || []).length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator className="mb-3" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">API Calls</span>
                        <p className="font-medium mt-0.5">{formatNumber(project.stats?.apiCalls || 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Queries</span>
                        <p className="font-medium mt-0.5">{formatNumber(project.stats?.databaseQueries || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * projectList.length }}
            >
              <button
                onClick={() => setShowCreateDialog(true)}
                className="w-full h-full rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-8 group"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Create New Project
                </span>
                <span className="text-xs text-muted-foreground">
                  Start building something new
                </span>
              </button>
            </motion.div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {activity.map((item) => {
                  const Icon = activityIcons[item.type];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.message}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {item.projectName}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {item.user}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {timeAgo(item.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>

      <CreateProjectDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </>
  );
}
