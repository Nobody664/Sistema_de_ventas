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

export function getSignInDestination(
  raw: string | null,
  roles: readonly string[],
): string {
  const target = safeRedirect(raw);
  const pathname = target.split(/[?#]/)[0];
  if (isPlatformUser(roles) && pathname === "/dashboard") return "/platform";
  if (
    !isPlatformUser(roles) &&
    (pathname === "/platform" || pathname.startsWith("/platform/"))
  ) {
    return getHomeRoute(roles);
  }
  return target;
}
