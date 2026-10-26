import { safeRedirect } from "./safe-redirect";

export function isPlatformUser(roles: readonly string[]): boolean {
  return roles.some(
    (role) => role === "SUPER_ADMIN" || role === "SUPPORT_ADMIN",
  );
}

export function getHomeRoute(
  roles: readonly string[],
): "/platform" | "/dashboard" {
  return isPlatformUser(roles) ? "/platform" : "/dashboard";
}

const PLATFORM_DESTINATIONS: ReadonlyArray<readonly [string, string]> = [
  ["/settings/company", "/platform/companies"],
  ["/subscription", "/platform/plans"],
  ["/checkout", "/platform/plans"],
  ["/payments", "/platform/finanzas"],
  ["/notifications", "/platform/notifications"],
  ["/support", "/platform/support"],
  ...[
    "/dashboard",
    "/inventory",
    "/categories",
    "/products",
    "/customers",
    "/employees",
    "/sales",
    "/distributors",
    "/suppliers",
    "/purchase-orders",
    "/stock-exits",
    "/discounts",
    "/finance",
    "/reports",
    "/credit-notes",
  ].map((prefix): readonly [string, string] => [prefix, "/platform"]),
];

export function getPlatformDestination(
  pathname: string,
  roles: readonly string[],
): string | null {
  if (!isPlatformUser(roles)) return null;
  return (
    PLATFORM_DESTINATIONS.find(
      ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )?.[1] ?? null
  );
}

export function getSignInDestination(
  raw: string | null,
  roles: readonly string[],
): string {
  const target = safeRedirect(raw);
  const pathname = target.split(/[?#]/)[0];
  const platformDestination = getPlatformDestination(pathname, roles);
  if (platformDestination) return platformDestination;
  if (
    !isPlatformUser(roles) &&
    (pathname === "/platform" || pathname.startsWith("/platform/"))
  ) {
    return getHomeRoute(roles);
  }
  return target;
}
