"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function useStoreFormTelemetry(enabled: boolean, companyId: string) {
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled) return;
    const records = new Map<
      HTMLFormElement,
      { form: string; start: number; dirty: boolean }
    >();
    const allowed = new Set([
      "CONFIGURATION",
      "ORDER_ACTION",
      "APPEARANCE",
      "NOTE",
      "VIEW",
    ]);
    const send = (event: string, record: { form: string; start: number }) => {
      void apiFetch("/store-admin/experience/events", {
        method: "POST",
        body: JSON.stringify({
          event,
          form: record.form,
          elapsedMs: Math.min(
            86400000,
            Math.max(0, Math.round(performance.now() - record.start)),
          ),
        }),
        skipRefresh: true,
        keepalive: true,
        timeoutMs: 3000,
      }).catch(() => undefined);
    };
    const record = (event: Event, dirty: boolean) => {
      if (!(event.target instanceof Element)) return;
      const form = event.target.closest<HTMLFormElement>(
        "form[data-store-form]",
      );
      const kind = form?.dataset.storeForm;
      if (!form || !kind || !allowed.has(kind)) return;
      let current = records.get(form);
      if (!current) {
        current = { form: kind, start: performance.now(), dirty: false };
        records.set(form, current);
        send("FORM_OPENED", current);
      }
      if (dirty) current.dirty = true;
    };
    const focus = (event: Event) => record(event, false);
    const input = (event: Event) => record(event, true);
    const success = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string")
        return;
      for (const [form, current] of records)
        if (form.dataset.storeResource === event.detail) {
          send("FORM_SAVED", current);
          records.delete(form);
        }
    };
    const finish = () => {
      for (const current of records.values())
        if (current.dirty) send("FORM_ABANDONED", current);
      records.clear();
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("input", input);
    document.addEventListener("change", input);
    window.addEventListener("store-admin:mutation", success);
    window.addEventListener("pagehide", finish);
    return () => {
      finish();
      document.removeEventListener("focusin", focus);
      document.removeEventListener("input", input);
      document.removeEventListener("change", input);
      window.removeEventListener("store-admin:mutation", success);
      window.removeEventListener("pagehide", finish);
    };
  }, [enabled, companyId, pathname]);
}
