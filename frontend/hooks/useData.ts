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

export function useProducts() {
  const token = getAccessToken();
  return useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: () => apiFetch<Product[]>('/products', { token: token ?? undefined }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategories() {
  const token = getAccessToken();
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: () => apiFetch<Category[]>('/products/categories', { token: token ?? undefined }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomers() {
  const token = getAccessToken();
  return useQuery({
    queryKey: QUERY_KEYS.customers,
    queryFn: () => apiFetch<Customer[]>('/customers', { token: token ?? undefined }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmployees() {
  const token = getAccessToken();
  return useQuery({
    queryKey: QUERY_KEYS.employees,
    queryFn: () => apiFetch<Employee[]>('/employees', { token: token ?? undefined }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSales() {
  const token = getAccessToken();
  return useQuery({
    queryKey: QUERY_KEYS.sales,
    queryFn: () => apiFetch<Sale[]>('/sales', { token: token ?? undefined }),
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