/**
 * Shared TypeScript types — cross-domain type definitions.
 */

export type Nullable<T> = T | null;

export type PaginationParams = {
  page: number;
  limit: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};
