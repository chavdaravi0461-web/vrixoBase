import { create } from 'zustand';
import type { DashboardProject } from '@/types/project';

interface ProjectStore {
  projects: DashboardProject[];
  currentProject: DashboardProject | null;

  setProjects: (projects: DashboardProject[]) => void;
  setCurrentProject: (project: DashboardProject | null) => void;
  addProject: (project: DashboardProject) => void;
  updateProject: (id: string, updates: Partial<DashboardProject>) => void;
  removeProject: (id: string) => void;
}

export const useProjectStore = create<ProjectStore>()((set) => ({
  projects: [],
  currentProject: null,

  setProjects: (projects) =>
    set({ projects }),

  setCurrentProject: (currentProject) =>
    set({ currentProject }),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, ...updates }
          : state.currentProject,
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject:
        state.currentProject?.id === id ? null : state.currentProject,
    })),
}));
