export function isPlatformRole(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "SUPPORT_ADMIN";
}
