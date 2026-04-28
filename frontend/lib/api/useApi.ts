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

export function useApi() {
  const get = useCallback(async <T>(url: string): Promise<ApiResult<T>> => {
    const { data, error } = await api.GET(url);
    return {
      data: data || null,
      error: error ? { message: error.message, status: error.status } : null,
      loading: false,
    };
  }, []);

  const post = useCallback(
    async <T, B = unknown>(url: string, body?: B): Promise<ApiResult<T>> => {
      const { data, error } = await api.POST(url, { body });
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
      const { data, error } = await api.PATCH(url, { body });
      return {
        data: data || null,
        error: error ? { message: error.message, status: error.status } : null,
        loading: false,
      };
    },
    []
  );

  const del = useCallback(async <T>(url: string): Promise<ApiResult<T>> => {
    const { data, error } = await api.DELETE(url);
    return {
      data: data || null,
      error: error ? { message: error.message, status: error.status } : null,
      loading: false,
    };
  }, []);

  return { get, post, patch, del };
}