import { create } from "zustand";
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getMe,
  updateProfile as apiUpdateProfile,
  refreshToken as apiRefreshToken,
  type AuthUser,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
  ) => Promise<void>;
  logout: () => Promise<boolean>;
  updateProfile: (fullName: string) => Promise<void>;
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
        error: error instanceof Error ? error.message : "Error de login",
      });
      throw error;
    }
  },

  register: async (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRegister({
        email,
        password,
        fullName,
        companyName,
      });
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
        error: error instanceof Error ? error.message : "Error de registro",
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiLogout();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cerrar la sesión",
      });
      return false;
    }
  },

  updateProfile: async (fullName: string) => {
    const response = await apiUpdateProfile(fullName);
    set({ user: response.user, isAuthenticated: true, error: null });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;

      if (status === 401) {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo verificar la sesión",
      });
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
