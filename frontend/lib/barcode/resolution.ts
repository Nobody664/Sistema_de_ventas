export interface BarcodeSuggestion {
  name: string;
  brand?: string;
  quantity?: string;
  description?: string;
}

export interface BarcodeResolution {
  source: "catalog" | "cache" | "openfoodfacts" | "none";
  product: { id: string; name: string; sku?: string | null } | null;
  suggestion: BarcodeSuggestion | null;
  reason?: "invalid" | "disabled" | "busy" | "unavailable";
}
