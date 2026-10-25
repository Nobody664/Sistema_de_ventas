import { notFound, redirect } from "next/navigation";
import {
  fetchServerApiResult,
  type ServerApiFailureKind,
} from "./server-api-result";

const API_URL = process.env.BACKEND_URL
  ? `${process.env.BACKEND_URL.replace(/\/$/, "")}/api`
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api");

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly kind: ServerApiFailureKind,
  ) {
    super("No se pudieron cargar los datos del servidor");
    this.name = "ServerApiError";
  }
}

export async function serverApiFetch<T>(
  path: string,
  accessToken?: string,
): Promise<T | null> {
  const result = await fetchServerApiResult<T>(
    `${API_URL}${path.startsWith("/") ? path : `/${path}`}`,
    accessToken,
  );
  if (result.ok) return result.data;
  if (result.kind === "unauthorized") redirect("/sign-in");
  if (result.kind === "forbidden") redirect("/forbidden");
  if (result.kind === "not_found") notFound();
  throw new ServerApiError(result.status, result.kind);
}
