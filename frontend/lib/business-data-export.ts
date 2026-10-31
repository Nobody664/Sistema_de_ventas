import { apiFetch, ApiError } from "@/lib/api";

export interface ExportManifest {
  format: "ventas.business-data";
  version: 1;
  startedAt: string;
  company: { id: string; name: string; [key: string]: unknown };
  collections: string[];
  consistency: string;
  decimalEncoding: string;
  excluded: string[];
}

interface ExportPage {
  collection: string;
  rows: unknown[];
  nextCursor: string | null;
}

async function waitForQuota(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 60000);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function downloadBusinessData(
  companyId: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
  request: typeof apiFetch = apiFetch,
): Promise<Blob> {
  const manifest = await request<ExportManifest>("/data-export/manifest", {
    signal,
  });
  signal.throwIfAborted();
  if (
    manifest.format !== "ventas.business-data" ||
    manifest.version !== 1 ||
    manifest.company?.id !== companyId ||
    !Array.isArray(manifest.collections)
  )
    throw new Error("La exportación no corresponde a este negocio o formato");
  const parts: BlobPart[] = [];
  let bytes = 0;
  let count = 0;
  const append = (text: string): void => {
    const part = new Blob([text]);
    bytes += part.size;
    if (bytes > 100 * 1024 * 1024)
      throw new Error(
        "La exportación supera 100 MiB. Contacta a soporte para una exportación asistida",
      );
    parts.push(part);
  };
  append(`{"manifest":${JSON.stringify(manifest)},"collections":{`);
  for (const [index, collection] of manifest.collections.entries()) {
    if (!/^[a-zA-Z]+$/.test(collection)) throw new Error("Colección inválida");
    append(`${index ? "," : ""}${JSON.stringify(collection)}:[`);
    let after: string | null = null;
    let first = true;
    const cursors = new Set<string>();
    do {
      signal.throwIfAborted();
      onProgress(
        `Colección ${index + 1} de ${manifest.collections.length}: ${collection}. ${count} registros descargados.`,
      );
      const query = new URLSearchParams({ startedAt: manifest.startedAt });
      if (after) query.set("after", after);
      const loadPage = async (): Promise<ExportPage> => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await request<ExportPage>(
              `/data-export/${collection}?${query}`,
              { signal },
            );
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              error.status !== 429 ||
              attempt >= 2
            )
              throw error;
            onProgress(
              "Límite temporal de solicitudes. La descarga continuará en un minuto; puedes cancelarla.",
            );
            await waitForQuota(signal);
          }
        }
      };
      const page = await loadPage();
      signal.throwIfAborted();
      if (
        page.collection !== collection ||
        !Array.isArray(page.rows) ||
        !(page.nextCursor === null || typeof page.nextCursor === "string")
      )
        throw new Error("Respuesta de exportación inválida");
      if (page.rows.length) {
        append(`${first ? "" : ","}${JSON.stringify(page.rows).slice(1, -1)}`);
        first = false;
        count += page.rows.length;
      }
      after = page.nextCursor;
      if (after && (cursors.has(after) || !page.rows.length))
        throw new Error("La paginación de exportación no avanzó");
      if (after) cursors.add(after);
    } while (after);
    append("]");
  }
  append(
    `},"completedAt":${JSON.stringify(new Date().toISOString())},"recordCount":${count}}`,
  );
  signal.throwIfAborted();
  return new Blob(parts, { type: "application/json" });
}
