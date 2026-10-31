const refreshing = new Map<string, Promise<boolean>>();

export class StoreApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function storeApi<T>(slug: string, path: string, body?: unknown, method?: string): Promise<T> {
  const url = `/api/store/${encodeURIComponent(slug)}/${path}`;
  const init: RequestInit = { method: method ?? (body === undefined ? "GET" : "POST"), credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
  let response = await fetch(url, init);
  if (response.status === 401 && !path.startsWith("auth/")) {
    if (!refreshing.has(slug)) refreshing.set(slug, fetch(`/api/store/${encodeURIComponent(slug)}/auth/refresh`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }).then((res) => res.ok).catch(() => false).finally(() => { refreshing.delete(slug); }));
    if (await refreshing.get(slug)) response = await fetch(url, init);
  }
  const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) throw new StoreApiError(Array.isArray(data?.message) ? data.message.join(". ") : data?.message ?? "No se pudo completar la solicitud", response.status);
  return data as T;
}
