"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { storeFieldRules } from "@/lib/store-validation";
import { storeInput } from "./store-ui";

export function StoreField({
  name,
  label,
  type = "text",
  value,
  error,
  disabled,
  required = true,
  newPassword = false,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  newPassword?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const rules = storeFieldRules[name] ?? { maxLength: 240 };
  const secret = type === "password";
  return (
    <div className="store-field">
      <label htmlFor={id}>
        {label}
        {!required && <span> (opcional)</span>}
      </label>
      <div className="store-field-input">
        <input
          id={id}
          name={name}
          type={secret && visible ? "text" : type}
          className={storeInput}
          defaultValue={value}
          required={required}
          disabled={disabled}
          minLength={rules.minLength}
          maxLength={rules.maxLength}
          inputMode={rules.inputMode}
          autoComplete={
            secret
              ? newPassword
                ? "new-password"
                : "current-password"
              : rules.autoComplete
          }
          aria-invalid={!!error}
          aria-describedby={error || rules.hint ? `${id}-help` : undefined}
        />
        {secret && (
          <button
            type="button"
            disabled={disabled}
            aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-help`} className="store-field-error" role="alert">
          {error}
        </p>
      ) : rules.hint ? (
        <p id={`${id}-help`} className="store-field-hint">
          {rules.hint}
        </p>
      ) : null}
    </div>
  );
}
