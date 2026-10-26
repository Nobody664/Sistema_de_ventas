const API_URL = "/api";
const DEFAULT_TIMEOUT_MS = 20_000;
const REFRESH_LOCK = "ventas-auth-refresh";
const REFRESH_STORAGE_KEY = "ventas:last-auth-refresh";
const REFRESH_COOLDOWN_MS = 5_000;

let refreshPromise: Promise<boolean> | null = null;
let lastRefreshAt = 0;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestInit extends RequestInit {
  token?: string;
  skipRefresh?: boolean;
  timeoutMs?: number;
}

function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (Array.isArray(record.message)) {
      return record.message
        .filter((item) => typeof item === "string")
        .join(". ");
    }
    if (typeof record.error === "string") return record.error;
  }
  return `Error ${status}`;
}

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  if (!text) {
    return new ApiError(`Error ${response.status}`, response.status);
  }

  try {
    const body: unknown = JSON.parse(text);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : undefined;
    const code =
      typeof record?.code === "string"
        ? record.code
        : typeof record?.error === "string"
          ? record.error
          : undefined;

    return new ApiError(
      messageFromBody(body, response.status),
      response.status,
      code,
      body,
    );
  } catch {
    return new ApiError(text, response.status);
  }
}

function readStoredRefreshAt(): number {
  try {
    return Number(window.localStorage.getItem(REFRESH_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRefreshed(): void {
  lastRefreshAt = Date.now();
  try {
    window.localStorage.setItem(REFRESH_STORAGE_KEY, String(lastRefreshAt));
  } catch {
    // Storage can be disabled; the in-memory timestamp still protects this tab.
  }
}

async function performRefresh(): Promise<boolean> {
  const recentlyRefreshed =
    Date.now() - Math.max(lastRefreshAt, readStoredRefreshAt()) <
    REFRESH_COOLDOWN_MS;
  if (recentlyRefreshed) return true;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "include",
    });

    if (!response.ok) return false;
    markRefreshed();
    return true;
  } catch {
    return false;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  const run = async (): Promise<boolean> => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request(REFRESH_LOCK, performRefresh);
    }
    return performRefresh();
  };

  refreshPromise = run()
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function buildRequestInit(init?: ApiRequestInit): {
  requestInit: RequestInit;
  timeoutMs: number;
} {
  const headers = new Headers(init?.headers);
  const token = init?.token;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = init?.body;
  const method = (init?.method ?? "GET").toUpperCase();
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (
    (body || isMutation) &&
    !(body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const { token: _token, skipRefresh: _skip, timeoutMs, ...rest } = init ?? {};

  return {
    requestInit: {
      ...rest,
      headers,
      credentials: "include",
    },
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

async function executeFetch(
  path: string,
  init?: ApiRequestInit,
): Promise<Response> {
  const { requestInit, timeoutMs } = buildRequestInit(init);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = requestInit.signal;

  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    return await fetch(`${API_URL}${path}`, {
      ...requestInit,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new ApiError(
        "La solicitud tardó demasiado. Intenta nuevamente.",
        0,
        "TIMEOUT",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

async function readBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await executeFetch(normalizedPath, init);

  if (
    response.status === 401 &&
    !init?.skipRefresh &&
    !normalizedPath.startsWith("/auth/")
  ) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      const retryResponse = await executeFetch(normalizedPath, init);
      if (!retryResponse.ok) throw await parseError(retryResponse);
      return readBody<T>(retryResponse);
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return readBody<T>(response);
}
