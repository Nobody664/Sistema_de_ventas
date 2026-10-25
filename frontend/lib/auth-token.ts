export type JwtPayload = Record<string, unknown>;

export function readJwtPayload(
  token: string | null | undefined,
): JwtPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

export function readJwtClaim(
  token: string | null | undefined,
  claim: string,
): unknown {
  return readJwtPayload(token)?.[claim];
}

export function isJwtExpired(
  token: string | null | undefined,
  now: number = Date.now(),
  skewSeconds = 30,
): boolean {
  const exp = readJwtPayload(token)?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return true;
  return exp * 1000 <= now + skewSeconds * 1000;
}
