const INTERNAL_ORIGIN = "https://app.internal";
const FALLBACK = "/dashboard";

export function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return FALLBACK;
  let decoded = raw;
  try {
    for (let index = 0; index < 5; index++) {
      if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//"))
        return FALLBACK;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      if (index === 4) return FALLBACK;
    }
    const normalized = new URL(decoded, INTERNAL_ORIGIN);
    if (
      normalized.origin !== INTERNAL_ORIGIN ||
      normalized.pathname.startsWith("//") ||
      /^\/(sign-in|sign-up|forgot-password|reset-password)(\/|$)/i.test(
        normalized.pathname,
      )
    )
      return FALLBACK;
    const target = new URL(raw, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN || target.pathname.startsWith("//"))
      return FALLBACK;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return FALLBACK;
  }
}
