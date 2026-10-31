import { parseDigitalLink } from "./digital-link";
import { isValidGtin, toGtin14 } from "./gtin";
import { Gs1ParseError, parseGs1, parseGs1Date, parseGs1Decimal } from "./gs1";
import { normalizeRaw } from "./normalize";

export type BarcodeKind =
  | "GTIN"
  | "GS1"
  | "DIGITAL_LINK"
  | "INTERNAL"
  | "UNKNOWN";

export interface ParsedBarcode {
  raw: string;
  normalized: string;
  kind: BarcodeKind;
  gtin?: string;
  gtinOriginal?: string;
  lot?: string;
  expiry?: string;
  productionDate?: string;
  serial?: string;
  netWeightKg?: number;
  price?: number;
  format?: string;
  warnings: string[];
}

const MAX_RAW_LENGTH = 2048;

const FORMAT_LABELS: Record<string, string> = {
  ean_13: "EAN-13",
  ean_8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  itf: "ITF",
  code_128: "Code 128",
  code_39: "Code 39",
  code_93: "Code 93",
  codabar: "Codabar",
  qr_code: "QR",
  data_matrix: "DataMatrix",
  pdf417: "PDF417",
  aztec: "Aztec",
};

export function barcodeFormatLabel(format?: string): string {
  if (!format || format === "unknown") return "Desconocido";
  return FORMAT_LABELS[format] ?? format.toUpperCase();
}

function readGs1Data(
  data: Record<string, string>,
  raw: string,
  kind: BarcodeKind,
  format?: string,
): ParsedBarcode {
  const warnings: string[] = [];
  const normalized = normalizeRaw(raw);
  const gtinValue = data["01"] ?? data["02"];

  let gtin: string | undefined;
  let gtinOriginal: string | undefined;

  if (gtinValue) {
    if (isValidGtin(gtinValue)) {
      gtinOriginal = gtinValue;
      gtin = toGtin14(gtinValue) ?? undefined;
    } else {
      warnings.push("El GTIN no tiene un dígito verificador válido.");
    }
  } else {
    warnings.push("El código GS1 no incluye GTIN.");
  }

  const expiryValue =
    data["17"] ??
    (data["7003"] ? data["7003"].slice(0, 6) : undefined) ??
    data["15"] ??
    data["16"];
  let expiry: string | undefined;

  if (expiryValue) {
    const parsed = parseGs1Date(expiryValue);
    if (parsed) {
      expiry = parsed;
    } else {
      warnings.push(`La fecha GS1 "${expiryValue}" no es válida.`);
    }
  }

  let productionDate: string | undefined;
  if (data["11"]) {
    const parsed = parseGs1Date(data["11"]);
    if (parsed) productionDate = parsed;
    else warnings.push(`La fecha de producción "${data["11"]}" no es válida.`);
  }

  const weightAi = Object.keys(data).find((ai) => /^310\d$/.test(ai));
  const netWeightKg = weightAi
    ? (parseGs1Decimal(weightAi, data[weightAi]) ?? undefined)
    : undefined;

  const priceAi = Object.keys(data).find((ai) => /^392\d$/.test(ai));
  const price = priceAi
    ? (parseGs1Decimal(priceAi, data[priceAi]) ?? undefined)
    : undefined;

  return {
    raw,
    normalized: gtin ?? normalized,
    kind,
    gtin,
    gtinOriginal,
    lot: data["10"],
    expiry,
    productionDate,
    serial: data["21"],
    netWeightKg,
    price,
    format,
    warnings,
  };
}

export function parseBarcode(raw: string, format?: string): ParsedBarcode {
  const trimmed = raw.trim();
  const base: ParsedBarcode = {
    raw: trimmed,
    normalized: trimmed,
    kind: "UNKNOWN",
    format,
    warnings: [],
  };

  if (!trimmed) {
    return { ...base, warnings: ["No se detectó contenido en el código."] };
  }

  if (trimmed.length > MAX_RAW_LENGTH) {
    return {
      ...base,
      warnings: ["El código supera el tamaño máximo permitido."],
    };
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    if (!/^https:\/\//i.test(trimmed)) {
      return {
        ...base,
        warnings: ["Solo se aceptan enlaces HTTPS en códigos QR."],
      };
    }

    const data = parseDigitalLink(trimmed);
    if (!data) {
      return {
        ...base,
        warnings: ["El enlace no contiene datos GS1 reconocibles."],
      };
    }

    const hasProductData =
      data["01"] ||
      data["02"] ||
      data["10"] ||
      data["15"] ||
      data["17"] ||
      data["7003"];

    if (!hasProductData) {
      return {
        ...base,
        warnings: ["El enlace no contiene datos GS1 reconocibles."],
      };
    }

    return readGs1Data(data, trimmed, "DIGITAL_LINK", format);
  }

  const normalized = normalizeRaw(trimmed);
  const hasAimPrefix = /^\][A-Za-z0-9]{2}/.test(trimmed);
  const humanReadable = trimmed.includes("(");

  if (/^\d{8}$|^\d{12,14}$/.test(normalized)) {
    const gtin14 = toGtin14(normalized);
    if (gtin14) {
      return {
        ...base,
        normalized: gtin14,
        kind: "GTIN",
        gtin: gtin14,
        gtinOriginal: normalized,
        warnings: [],
      };
    }

    return {
      ...base,
      normalized,
      kind: "GTIN",
      gtinOriginal: normalized,
      warnings: [
        "El dígito verificador del GTIN no es válido; el código se guardará tal cual.",
      ],
    };
  }

  const looksGs1 =
    hasAimPrefix ||
    humanReadable ||
    normalized.includes("|") ||
    /^(00|01|02)/.test(normalized);

  if (looksGs1) {
    try {
      const data = parseGs1(trimmed);
      if (Object.keys(data).length > 0) {
        return readGs1Data(data, trimmed, "GS1", format);
      }
    } catch (error) {
      return {
        ...base,
        normalized,
        warnings: [
          error instanceof Gs1ParseError
            ? error.message
            : "No se pudo interpretar el código GS1.",
        ],
      };
    }
  }

  return {
    ...base,
    normalized,
    kind: "INTERNAL",
    warnings: [
      "Código interno o de texto libre: no se puede enriquecer automáticamente.",
    ],
  };
}
