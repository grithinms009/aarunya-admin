import { create } from 'zustand';
import { auth } from '@/api';
import type { AdminUser } from '@/data/types';

interface AuthState {
  user: AdminUser | null;
  ready: boolean;
  load: () => Promise<void>;
  signIn: (u: AdminUser) => void;
  signOut: () => Promise<void>;
  setUser: (u: AdminUser) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  load: async () => {
    const user = await auth.me();
    set({ user, ready: true });
  },
  signIn: (user) => set({ user }),
  setUser: (user) => set({ user }),
  signOut: async () => {
    await auth.logout();
    set({ user: null });
  },
}));
