export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function getSetCookieHeaders(headers: Headers): string[] {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === "function") {
    return candidate.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export function readSetCookieValue(
  headers: readonly string[],
  name: string,
): string | undefined {
  for (const header of headers) {
    const [pair] = header.split(";");
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const cookieName = pair.slice(0, separator).trim();
    if (cookieName !== name) continue;

    const rawValue = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return undefined;
}
