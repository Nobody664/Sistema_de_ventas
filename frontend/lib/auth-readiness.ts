import { ApiError } from "./api/client";

export type AuthStage = "connecting" | "authenticating";
export interface AuthRequestOptions {
  signal?: AbortSignal;
  onStage?: (stage: AuthStage) => void;
}

interface ReadinessOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  requestTimeoutMs?: number;
  retryDelayMs?: number;
}

function abortError(): DOMException {
  return new DOMException("Solicitud cancelada", "AbortError");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function backendReady(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const result = value as {
    status?: string;
    service?: string;
    checks?: { database?: { status?: string } };
  };
  return (
    result.service === "backend" &&
    ["ok", "degraded"].includes(result.status ?? "") &&
    result.checks?.database?.status === "ok"
  );
}

export async function waitForAuthBackend({
  signal,
  timeoutMs = 90000,
  requestTimeoutMs = 10000,
  retryDelayMs = 1500,
}: ReadinessOptions = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw abortError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(requestTimeoutMs, deadline - Date.now()),
    );
    try {
      const response = await fetch("/api/health/ready", {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if ([400, 401, 403, 404, 429].includes(response.status))
        throw new ApiError(
          response.status === 429
            ? "Se alcanzó el límite de conexiones. Espera un momento antes de volver a intentar."
            : "No se pudo comprobar el servidor de acceso. Intenta más tarde.",
          response.status,
          "BACKEND_READINESS_FAILED",
        );
      const json = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? ((await response.json()) as unknown)
        : null;
      if (signal?.aborted) throw abortError();
      if (response.ok && backendReady(json)) return;
      if (!json) await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      if (error instanceof ApiError) throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await delay(Math.min(retryDelayMs, remaining), signal);
  }
  throw new ApiError(
    "El servidor no terminó de activarse. Tu contraseña aún no se ha enviado. Espera un momento y vuelve a intentar.",
    0,
    "BACKEND_STARTUP_TIMEOUT",
  );
}
