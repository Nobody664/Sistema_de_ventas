interface LimitError {
  error?: string;
  message?: string;
}

interface ErrorResult {
  message: string;
  isLimitError: boolean;
}

export function handleLimitError(err: unknown): ErrorResult {
  let message = 'Error desconocido';
  let isLimitError = false;

  if (err && typeof err === 'object' && 'message' in err) {
    const errorObj = err as LimitError;
    message = errorObj.message || message;

    if (errorObj.error === 'LIMIT_EXCEEDED' || message.includes('límite')) {
      isLimitError = true;
      const limitMatch = message.match(/Has alcanzado el límite de ([^.]+)/);
      if (limitMatch) {
        message = `Has alcanzado el límite de ${limitMatch[1]}. Para continuar, considera mejorar tu plan.`;
      }
    }
  } else if (err instanceof Error) {
    message = err.message;
  }

  return { message, isLimitError };
}
