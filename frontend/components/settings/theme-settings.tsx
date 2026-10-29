"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Palette } from "lucide-react";

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <Palette className="size-5 text-orange-500" />
        <h2 className="font-display text-xl font-semibold">Apariencia</h2>
      </div>
      <label className="mt-5 block text-sm font-medium">
        Tema
        <select
          aria-label="Tema"
          value={mounted ? (theme ?? "system") : "system"}
          disabled={!mounted}
          onChange={(event) => setTheme(event.target.value)}
          className="mt-2 w-full rounded-xl border bg-background px-3 py-2"
        >
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
          <option value="system">Sistema</option>
        </select>
      </label>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Se aplica de inmediato y se guarda en este navegador. El botón del
        encabezado usa esta misma preferencia.
      </p>
    </section>
  );
}
