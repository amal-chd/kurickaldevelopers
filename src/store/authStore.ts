import { create } from 'zustand';
import { User } from 'firebase/auth';
import { AppUser, Role, Permissions } from '../types';

interface AuthState {
  firebaseUser: User | null;
  appUser: AppUser | null;
  role: Role | null;
  permissions: Permissions;
  loading: boolean;
  initialized: boolean;
  setFirebaseUser: (user: User | null) => void;
  setAppUser: (user: AppUser | null) => void;
  setRole: (role: Role | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  appUser: null,
  role: null,
  permissions: {},
  loading: true,
  initialized: false,
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setAppUser: (user) => set({ appUser: user }),
  setRole: (role) => set({ role, permissions: role?.permissions ?? {} }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  reset: () =>
    set({
      firebaseUser: null,
      appUser: null,
      role: null,
      permissions: {},
      loading: false,
    }),
}));
