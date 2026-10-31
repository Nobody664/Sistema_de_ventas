import { normalizeRaw } from "./normalize";

export class Gs1ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Gs1ParseError";
  }
}

interface AiSpec {
  fixed?: number;
  max?: number;
}

const AI_SPECS: Record<string, AiSpec> = {
  "00": { fixed: 18 },
  "01": { fixed: 14 },
  "02": { fixed: 14 },
  "10": { max: 20 },
  "11": { fixed: 6 },
  "12": { fixed: 6 },
  "13": { fixed: 6 },
  "15": { fixed: 6 },
  "16": { fixed: 6 },
  "17": { fixed: 6 },
  "20": { fixed: 2 },
  "21": { max: 20 },
  "22": { max: 20 },
  "30": { max: 8 },
  "37": { max: 8 },
  "240": { max: 30 },
  "400": { max: 30 },
  "401": { max: 30 },
  "402": { fixed: 17 },
  "403": { max: 30 },
  "410": { fixed: 13 },
  "411": { fixed: 13 },
  "412": { fixed: 13 },
  "413": { fixed: 13 },
  "414": { fixed: 13 },
  "415": { fixed: 13 },
  "416": { fixed: 13 },
  "417": { fixed: 13 },
  "420": { max: 20 },
  "421": { max: 15 },
  "422": { fixed: 3 },
  "423": { max: 15 },
  "424": { fixed: 3 },
  "425": { fixed: 3 },
  "426": { fixed: 3 },
  "427": { fixed: 3 },
  "7003": { fixed: 10 },
  "8005": { fixed: 6 },
  "8018": { fixed: 18 },
};

for (let digit = 0; digit <= 9; digit++) {
  for (let family = 310; family <= 316; family++) {
    AI_SPECS[`${family}${digit}`] = { fixed: 6 };
  }
  for (let family = 320; family <= 337; family++) {
    AI_SPECS[`${family}${digit}`] = { fixed: 6 };
  }
  for (let family = 390; family <= 395; family++) {
    AI_SPECS[`${family}${digit}`] = { max: 15 };
  }
}

for (let family = 90; family <= 99; family++) {
  AI_SPECS[String(family)] = { max: 30 };
}

function matchAi(
  text: string,
  at: number,
): { ai: string; spec: AiSpec } | null {
  for (const size of [4, 3, 2]) {
    const candidate = text.slice(at, at + size);
    const spec = AI_SPECS[candidate];
    if (spec) return { ai: candidate, spec };
  }
  return null;
}

export function parseGs1(raw: string): Record<string, string> {
  const text = normalizeRaw(raw);
  if (!text) throw new Gs1ParseError("El código GS1 está vacío.");

  const data: Record<string, string> = {};
  let index = 0;

  while (index < text.length) {
    if (text[index] === "|") {
      index++;
      continue;
    }

    const match = matchAi(text, index);
    if (!match) {
      throw new Gs1ParseError(
        `No se reconoce el identificador GS1 en la posición ${index}.`,
      );
    }

    const { ai, spec } = match;
    index += ai.length;

    if (spec.fixed) {
      const value = text.slice(index, index + spec.fixed);
      if (value.length !== spec.fixed || value.includes("|")) {
        throw new Gs1ParseError(`El campo ${ai} está incompleto.`);
      }
      data[ai] = value;
      index += spec.fixed;
      continue;
    }

    const end = text.indexOf("|", index);
    const value = text.slice(index, end === -1 ? undefined : end);
    if (!value) {
      throw new Gs1ParseError(`El campo ${ai} está vacío.`);
    }
    if (spec.max && value.length > spec.max) {
      throw new Gs1ParseError(
        `El campo ${ai} supera los ${spec.max} caracteres permitidos.`,
      );
    }

    data[ai] = value;
    index = end === -1 ? text.length : end;
  }

  return data;
}

export function parseGs1Date(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null;

  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));

  if (month < 1 || month > 12) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const effectiveDay = day === 0 ? lastDay : day;
  if (effectiveDay < 1 || effectiveDay > lastDay) return null;

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(effectiveDay)}`;
}

export function parseGs1Decimal(ai: string, value: string): number | null {
  if (!/^\d{4}$/.test(ai) || !/^\d+$/.test(value)) return null;
  const decimals = Number(ai[3]);
  return Number(value) / 10 ** decimals;
}
