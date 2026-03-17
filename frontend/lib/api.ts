const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export async function apiFetch<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const initHeaders = init?.headers as Record<string, string> | undefined;
  if (initHeaders?.['Authorization']) {
    headers['Authorization'] = initHeaders['Authorization'];
  } else if (init?.token) {
    headers['Authorization'] = `Bearer ${init.token}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== 'undefined') {
        const { signOut } = await import('next-auth/react');
        const { error: errorData } = JSON.parse(errorText);
        throw new Error(errorData?.message || (response.status === 401 ? 'Sesión expirada' : 'No tienes permisos para esta acción'));
      }
    }

    try {
      const error = JSON.parse(errorText);
      if (error.error !== 'LIMIT_EXCEEDED') {
        console.error('API Error:', response.status, errorText);
      }
      throw new Error(error.message || `Error ${response.status}`, {
        cause: error,
      });
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(errorText || `Error ${response.status}`);
      }
      throw e;
    }
  }

  return response.json() as Promise<T>;
}
