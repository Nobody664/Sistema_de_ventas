import { create } from 'zustand';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getMe,
  refreshToken as apiRefreshToken,
  type AuthUser,
} from '@/lib/api/auth';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiLogin({ email, password });
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error de login',
      });
      throw error;
    }
  },

  register: async (email: string, password: string, fullName: string, companyName: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRegister({ email, password, fullName, companyName });
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error de registro',
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await apiLogout();
    } catch {
      // Ignore logout errors
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  refreshSession: async () => {
    try {
      await apiRefreshToken();
      const user = await getMe();
      set({ user, isAuthenticated: true, error: null });
      return true;
    } catch {
      set({ user: null, isAuthenticated: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));