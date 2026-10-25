export { apiFetch, ApiError } from "./api/client";
export type { ApiRequestInit } from "./api/client";
export { getAccessToken } from "./api/auth";
export {
  login,
  register,
  logout,
  getMe,
  refreshToken,
  updateProfile,
} from "./api/auth";
export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  AuthUser,
  RefreshResponse,
} from "./api/auth";
export type { SessionUser } from "./session-contract";
