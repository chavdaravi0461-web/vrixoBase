'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import * as authApi from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  const setLoading = useAuthStore((s) => s.setLoading);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onMutate: () => setLoading(true),
    onSuccess: (data) => {
      login(data.user as any, data.accessToken, data.refreshToken);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onSettled: () => setLoading(false),
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);
  const setLoading = useAuthStore((s) => s.setLoading);

  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string }) =>
      authApi.register(data),
    onMutate: () => setLoading(true),
    onSuccess: (data) => {
      login(data.user as any, data.accessToken, data.refreshToken);
    },
    onSettled: () => setLoading(false),
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
      queryClient.clear();
      router.push('/auth/login');
    },
  });
}

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await authApi.getMe();
      setUser(user as any);
      return user;
    },
    enabled: !!accessToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
    meta: {
      onSettled: () => setLoading(false),
    },
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: () => {
      authApi.googleLogin();
      return new Promise<never>(() => {});
    },
  });
}

export function useGithubLogin() {
  return useMutation({
    mutationFn: () => {
      authApi.githubLogin();
      return new Promise<never>(() => {});
    },
  });
}
