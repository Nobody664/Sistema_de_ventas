import { create } from "zustand";
import {
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  register as apiRegister,
  logout as apiLogout,
  getMe,
  updateAvatar as apiUpdateAvatar,
  updateProfile as apiUpdateProfile,
  refreshToken as apiRefreshToken,
  type AuthUser,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { AuthRequestOptions } from "@/lib/auth-readiness";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (
    email: string,
    password: string,
    options?: AuthRequestOptions,
  ) => Promise<void>;
  loginWithGoogle: (
    credential: string,
    options?: AuthRequestOptions,
  ) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
  ) => Promise<void>;
  logout: () => Promise<boolean>;
  updateProfile: (fullName: string) => Promise<void>;
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}

let authRevision = 0;
let authCheck = 0;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (
    email: string,
    password: string,
    options?: AuthRequestOptions,
  ) => {
    const revision = ++authRevision;
    set({ isLoading: true, error: null });
    try {
      const response = await apiLogin({ email, password }, options);
      if (revision !== authRevision)
        throw new ApiError(
          "La solicitud de acceso fue reemplazada",
          0,
          "AUTH_SUPERSEDED",
        );
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (revision !== authRevision) throw error;
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Error de login",
      });
      throw error;
    }
  },

  loginWithGoogle: async (
    credential: string,
    options?: AuthRequestOptions,
  ) => {
    const revision = ++authRevision;
    set({ isLoading: true, error: null });
    try {
      const response = await apiLoginWithGoogle(credential, options);
      if (revision !== authRevision)
        throw new ApiError(
          "La solicitud de acceso fue reemplazada",
          0,
          "AUTH_SUPERSEDED",
        );
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (revision !== authRevision) throw error;
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
    const revision = ++authRevision;
    set({ isLoading: true, error: null });
    try {
      const response = await apiRegister({
        email,
        password,
        fullName,
        companyName,
      });
      if (revision !== authRevision)
        throw new ApiError(
          "La solicitud de registro fue reemplazada",
          0,
          "AUTH_SUPERSEDED",
        );
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (revision !== authRevision) throw error;
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
    const revision = ++authRevision;
    set({ isLoading: true, error: null });
    try {
      await apiLogout();
      if (revision !== authRevision) return false;
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (error) {
      if (revision !== authRevision) return false;
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
    const revision = ++authRevision;
    try {
      const response = await apiUpdateProfile(fullName);
      if (revision === authRevision)
        set({
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
    } catch (error) {
      if (revision === authRevision) set({ isLoading: false });
      throw error;
    }
  },

  updateAvatar: async (avatarUrl: string | null) => {
    const result = await apiUpdateAvatar(avatarUrl);
    set((state) => ({
      user: state.user
        ? { ...state.user, avatarUrl: result.avatarUrl }
        : state.user,
      isLoading: false,
      error: null,
    }));
  },

  checkAuth: async () => {
    const revision = authRevision;
    const check = ++authCheck;
    set({ isLoading: true });
    try {
      const user = await getMe();
      if (revision !== authRevision || check !== authCheck) return;
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      if (revision !== authRevision || check !== authCheck) return;
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
    const revision = ++authRevision;
    try {
      await apiRefreshToken();
      const user = await getMe();
      if (revision !== authRevision) return false;
      set({ user, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch {
      if (revision !== authRevision) return false;
      set({ user: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
