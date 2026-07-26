/**
 * Shared utility functions — domain-agnostic helpers.
 */

export function generateId(): string {
  return crypto.randomUUID();
}

export function now(): Date {
  return new Date();
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}
