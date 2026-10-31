const AIM_PREFIX = /^\][A-Za-z0-9]{2}/;
const GS = "\u001d";

export function normalizeRaw(raw: string): string {
  let value = raw.replace(AIM_PREFIX, "").replace(/\r?\n/g, "").trim();

  if (value.includes("(")) {
    const parts: string[] = [];
    const groupPattern = /\((\d{2,4})\)([^()]*)/g;
    let match: RegExpExecArray | null;

    while ((match = groupPattern.exec(value)) !== null) {
      const ai = match[1];
      const data = match[2].replace(/\s+/g, "");
      if (data) parts.push(`${ai}${data}`);
    }

    if (parts.length > 0) value = parts.join("|");
  }

  return value
    .split(GS)
    .join("|")
    .replace(/\|+/g, "|")
    .replace(/^\||\|$/g, "");
}
