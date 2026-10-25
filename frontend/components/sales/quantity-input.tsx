"use client";

import { useEffect, useState } from "react";
import { clampSaleQuantity, formatSaleQuantity } from "@/lib/sale-quantity";

interface QuantityInputProps {
  value: number;
  step: number;
  max: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}

export function QuantityInput({
  value,
  step,
  max,
  disabled,
  label,
  onChange,
}: QuantityInputProps) {
  const [draft, setDraft] = useState(() => formatSaleQuantity(value, step));

  useEffect(() => {
    setDraft(formatSaleQuantity(value, step));
  }, [value, step]);

  const reset = () => setDraft(formatSaleQuantity(value, step));

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      reset();
      return;
    }
    const next = clampSaleQuantity(parsed, step, max);
    if (next <= 0) {
      reset();
      return;
    }
    onChange(next);
    setDraft(formatSaleQuantity(next, step));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value.replace(",", "."))}
      onBlur={commit}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          reset();
          event.currentTarget.blur();
        }
      }}
      className="h-8 w-16 rounded-lg border border-border bg-card px-2 text-center text-sm font-semibold text-foreground disabled:opacity-30"
    />
  );
}
