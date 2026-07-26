/**
 * Cache Port
 *
 * Contract for cache operations on OrganizationAggregate data.
 * Used for caching frequently-read organization profiles.
 *
 * @traceability PAS-001 Port-010 (CachePort)
 */

export interface ICachePort {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}
