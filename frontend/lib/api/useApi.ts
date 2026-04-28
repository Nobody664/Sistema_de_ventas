import { useCallback } from 'react';
import { api } from './api.client';

interface ApiError {
  message: string;
  status: number;
}

interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiClient = typeof api;

export function useApi() {
  const client = api as any;

  const get = useCallback(async <T>(url: string): Promise<ApiResult<T>> => {
    const { data, error } = await client.GET(url);
    return {
      data: data || null,
      error: error ? { message: error.message, status: error.status } : null,
      loading: false,
    };
  }, []);

  const post = useCallback(
    async <T, B = unknown>(url: string, body?: B): Promise<ApiResult<T>> => {
      const { data, error } = await client.POST(url, { body });
      return {
        data: data || null,
        error: error ? { message: error.message, status: error.status } : null,
        loading: false,
      };
    },
    []
  );

  const patch = useCallback(
    async <T, B = unknown>(url: string, body?: B): Promise<ApiResult<T>> => {
      const { data, error } = await client.PATCH(url, { body });
      return {
        data: data || null,
        error: error ? { message: error.message, status: error.status } : null,
        loading: false,
      };
    },
    []
  );

  const del = useCallback(async <T>(url: string): Promise<ApiResult<T>> => {
    const { data, error } = await client.DELETE(url);
    return {
      data: data || null,
      error: error ? { message: error.message, status: error.status } : null,
      loading: false,
    };
  }, []);

  return { get, post, patch, del };
}