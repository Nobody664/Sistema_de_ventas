function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseDigitalLink(raw: string): Record<string, string> | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;

  const data: Record<string, string> = {};
  const segments = url.pathname.split("/").filter(Boolean);
  const start = segments.findIndex((segment) => /^\d{2,4}$/.test(segment));

  for (
    let index = start;
    index >= 0 && index + 1 < segments.length;
    index += 2
  ) {
    const ai = segments[index];
    if (/^\d{2,4}$/.test(ai)) {
      data[ai] = safeDecode(segments[index + 1]);
    }
  }

  for (const [key, value] of url.searchParams) {
    if (/^\d{2,4}$/.test(key)) data[key] = value;
  }

  return Object.keys(data).length > 0 ? data : null;
}
