'use client';

import { create } from 'zustand';
import type { User } from '@/types';
import type { AuthState } from '@/types/user';

interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setTokens: (accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vrixo_access_token', accessToken);
      localStorage.setItem('vrixo_refresh_token', refreshToken);
    }
    set({ accessToken, refreshToken });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  login: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vrixo_access_token', accessToken);
      localStorage.setItem('vrixo_refresh_token', refreshToken);
      localStorage.setItem('vrixo_user', JSON.stringify(user));
    }
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vrixo_access_token');
      localStorage.removeItem('vrixo_refresh_token');
      localStorage.removeItem('vrixo_user');
    }
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  hydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('vrixo_access_token');
      const userStr = localStorage.getItem('vrixo_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          set({
            user,
            accessToken: token,
            refreshToken: localStorage.getItem('vrixo_refresh_token'),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    }
  },
}));
