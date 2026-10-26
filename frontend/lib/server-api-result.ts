export type ServerApiFailureKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "http"
  | "network"
  | "invalid_response";

export type ServerApiResult<T> =
  | { ok: true; status: number; data: T | null }
  | { ok: false; status: number; kind: ServerApiFailureKind };

export interface ServerApiOptions {
  allowEmpty?: boolean;
}

export async function fetchServerApiResult<T>(
  url: string,
  accessToken?: string,
  options: ServerApiOptions = {},
): Promise<ServerApiResult<T>> {
  if (!accessToken) return { ok: false, status: 401, kind: "unauthorized" };
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const kind =
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : response.status === 404
              ? "not_found"
              : "http";
      return { ok: false, status: response.status, kind };
    }
    if (response.status === 204) return { ok: true, status: 204, data: null };
    text = await response.text();
    if (options.allowEmpty && text.trim() === "") {
      return { ok: true, status: response.status, data: null };
    }
  } catch {
    return { ok: false, status: 0, kind: "network" };
  }
  try {
    return {
      ok: true,
      status: response.status,
      data: JSON.parse(text) as T | null,
    };
  } catch {
    return { ok: false, status: response.status, kind: "invalid_response" };
  }
}
