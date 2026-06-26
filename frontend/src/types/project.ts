import type { Project, ProjectPlan, ProjectStatus } from './index';

export type { Project, ProjectPlan, ProjectStatus };

export interface ProjectStats {
  apiCalls: number;
  storageUsed: number;
  storageLimit: number;
  databaseQueries: number;
  functionsCount: number;
}

export interface DashboardMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
}

export interface DashboardProject extends Project {
  description: string;
  stats: ProjectStats;
  members: DashboardMember[];
}

export interface RecentActivity {
  id: string;
  type: 'api_call' | 'query' | 'deploy' | 'member' | 'setting';
  message: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  user: string;
}
