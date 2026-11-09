export interface StoreAppearance {
  schemaVersion: 1;
  themePreset: "petroleo-crema" | "terracota-arena" | "bosque-marfil";
  headline: string;
  heroDescription: string;
  logoAssetId: string | null;
  coverAssetId: string | null;
  showDescription: boolean;
  showBusinessPhone: boolean;
}
export type PublicStoreAppearance = Omit<
  StoreAppearance,
  "logoAssetId" | "coverAssetId"
> & { logoUrl: string | null; coverUrl: string | null };
export const appearancePresets = {
  "petroleo-crema": "Petróleo y crema",
  "terracota-arena": "Terracota y arena",
  "bosque-marfil": "Bosque y marfil",
};

export function savedStoreDefinition(
  resource: "ORDERS" | "CATALOG" | "CUSTOMERS",
  params: URLSearchParams,
): Record<string, string> {
  const layout = params.get("view");
  const result: Record<string, string> = {
    layout:
      resource === "ORDERS"
        ? layout === "board"
          ? "board"
          : "list"
        : resource === "CATALOG"
          ? layout === "list"
            ? "list"
            : "gallery"
          : "list",
  };
  const allowed =
    resource === "ORDERS"
      ? ["queue", "status", "paymentStatus", "shippingKind"]
      : resource === "CATALOG"
        ? ["publication", "activity"]
        : ["status"];
  for (const key of allowed) {
    const value = params.get(key);
    if (value) result[key] = value;
  }
  return result;
}
