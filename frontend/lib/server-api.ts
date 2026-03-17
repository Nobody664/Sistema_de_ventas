const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export async function serverApiFetch<T>(path: string, accessToken?: string): Promise<T | null> {
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[API ERROR] ${path}: ${response.status} ${response.statusText}`);
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch (error) {
    console.error(`[API ERROR] ${path}:`, error);
    return null;
  }
}

