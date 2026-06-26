'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { useProjectStore } from '@/stores/project-store';
import type { DashboardProject } from '@/types/project';

export function useProjects() {
  const setProjects = useProjectStore((s) => s.setProjects);

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await apiRequest<DashboardProject[]>('/api/projects');
      setProjects(data);
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useProject(id: string) {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const data = await apiRequest<DashboardProject>(`/api/projects/${id}`);
      setCurrentProject(data);
      return data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const addProject = useProjectStore((s) => s.addProject);

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; region?: string }) => {
      return apiRequest<DashboardProject>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (project) => {
      addProject(project);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const updateProject = useProjectStore((s) => s.updateProject);

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string }) => {
      return apiRequest<DashboardProject>(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (project) => {
      updateProject(project.id, project);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const removeProject = useProjectStore((s) => s.removeProject);

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      removeProject(id);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
