'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/api/auth';
import type { Product, Category, Customer, Employee, Sale } from '@/types/api';

const QUERY_KEYS = {
  products: ['products'],
  categories: ['categories'],
  customers: ['customers'],
  employees: ['employees'],
  sales: ['sales'],
} as const;

function withToken<T>(path: string) {
  return async (): Promise<T> => {
    const token = getAccessToken();
    return apiFetch<T>(path, { token: token ?? undefined });
  };
}

export function useProducts() {
  return useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: withToken<Product[]>('/products'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: withToken<Category[]>('/products/categories'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: QUERY_KEYS.customers,
    queryFn: withToken<Customer[]>('/customers'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: QUERY_KEYS.employees,
    queryFn: withToken<Employee[]>('/employees'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSales() {
  return useQuery({
    queryKey: QUERY_KEYS.sales,
    queryFn: withToken<Sale[]>('/sales'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
}

export function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories });
}

export function useInvalidateCustomers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers });
}

export function useInvalidateEmployees() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
}

export function useInvalidateSales() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sales });
}