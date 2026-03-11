const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const initHeaders = init?.headers as Record<string, string> | undefined;
  if (initHeaders?.['Authorization']) {
    headers['Authorization'] = initHeaders['Authorization'];
  } else if (init?.token) {
    headers['Authorization'] = `Bearer ${init.token}`;
  } else {
    try {
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({ req: new Request('http://localhost') });
      if (token?.accessToken) {
        headers['Authorization'] = `Bearer ${token.accessToken}`;
      }
    } catch {}
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(error.message || `API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
