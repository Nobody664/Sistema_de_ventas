interface LimitError {
  error?: string;
  message?: string;
  cause?: { error?: string; message?: string };
}

interface ErrorResult {
  message: string;
  isLimitError: boolean;
}

const PLAN_UPGRADE_CODES = new Set([
  "MODULE_NOT_ENABLED",
  "FEATURE_NOT_AVAILABLE",
  "PLAN_REQUIRED",
]);

function extractCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const direct = (err as LimitError).error;
    if (typeof direct === "string") return direct;

    const cause = (err as LimitError).cause;
    if (cause && typeof cause === "object" && typeof cause.error === "string") {
      return cause.error;
    }
  }
  return undefined;
}

export function handleLimitError(err: unknown): ErrorResult {
  let message = "Error desconocido";
  let isLimitError = false;

  if (err && typeof err === "object" && "message" in err) {
    const errorObj = err as LimitError;
    message = errorObj.message || message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  const code = extractCode(err);

  if (
    code === "LIMIT_EXCEEDED" ||
    code === "API_QUOTA_EXCEEDED" ||
    message.includes("límite")
  ) {
    isLimitError = true;
    const limitMatch = message.match(/Has alcanzado el límite de ([^.]+)/);
    if (limitMatch) {
      message = `Has alcanzado el límite de ${limitMatch[1]}. Para continuar, considera mejorar tu plan.`;
    }
  } else if (code && PLAN_UPGRADE_CODES.has(code)) {
    isLimitError = true;
    if (!message.includes("Mejora tu plan")) {
      message = `${message} Mejora tu plan para desbloquearlo.`;
    }
  }

  return { message, isLimitError };
}
