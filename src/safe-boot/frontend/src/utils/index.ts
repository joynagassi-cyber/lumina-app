/**
 * Utility functions — shared helpers for frontend domains.
 */

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export function formatDateTime(date: Date): string {
  return date.toISOString();
}
