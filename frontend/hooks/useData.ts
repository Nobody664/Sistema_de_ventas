'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useSession } from 'next-auth/react';
import type { Product, Category, Customer, Employee, Sale } from '@/types/api';

const QUERY_KEYS = {
  products: ['products'],
  categories: ['categories'],
  customers: ['customers'],
  employees: ['employees'],
  sales: ['sales'],
} as const;

export function useProducts() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: () => apiFetch<Product[]>('/products', { token: session?.accessToken }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategories() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: () => apiFetch<Category[]>('/products/categories', { token: session?.accessToken }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomers() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: QUERY_KEYS.customers,
    queryFn: () => apiFetch<Customer[]>('/customers', { token: session?.accessToken }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmployees() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: QUERY_KEYS.employees,
    queryFn: () => apiFetch<Employee[]>('/employees', { token: session?.accessToken }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSales() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: QUERY_KEYS.sales,
    queryFn: () => apiFetch<Sale[]>('/sales', { token: session?.accessToken }),
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
