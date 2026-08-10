/**
 * Query Builder core types — shared by the Flexible Report Engine.
 *
 * @traceability QUERY-BUILDER-SPEC-V1.md §Model
 */

/** Field data types supported by the query builder. */
export type DataType = 'string' | 'number' | 'date' | 'boolean';

/** Comparison operators for filter conditions. */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

/** Aggregation functions available in the query builder. */
export type AggregationType =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'percentage'
  | 'distinct';
