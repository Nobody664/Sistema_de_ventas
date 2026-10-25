import { hashKey } from "@tanstack/react-query";

let currentScope = "anonymous";

export function setQueryScope(scope: string): void {
  currentScope = scope;
}

export function getQueryScope(): string {
  return currentScope;
}

export function scopedQueryKeyHash(queryKey: readonly unknown[]): string {
  return hashKey([currentScope, ...queryKey]);
}
