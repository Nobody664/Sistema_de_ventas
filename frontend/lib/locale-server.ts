import "server-only";
import { cookies } from "next/headers";
import { localeFromValue, translate } from "./i18n";

export async function serverTranslator() {
  const locale = localeFromValue((await cookies()).get("ventas_locale")?.value);
  return (text: string): string => translate(locale, text);
}
