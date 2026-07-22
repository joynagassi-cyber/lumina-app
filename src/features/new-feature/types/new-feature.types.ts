/**
 * New Feature Types -- strict TypeScript, no `any`.
 */

// ---------------------------------------------------------------------------
// Status enum (federated through Vocabulary Engine at runtime)
// ---------------------------------------------------------------------------

export const NEW_FEATURE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLOSED: 'closed',
} as const;

export type NewFeatureStatus = (typeof NEW_FEATURE_STATUSES)[keyof typeof NEW_FEATURE_STATUSES];

const VALID_STATUSES = new Set(Object.values(NEW_FEATURE_STATUSES));

export function isValidStatus(value: unknown): value is NewFeatureStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value);
}

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

export interface NewFeatureBase {
  id: string;
  orgId: string;
  title: string;
  description?: string | undefined;
  status: NewFeatureStatus;
  version: number;
  createdBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NewFeatureListItem extends NewFeatureBase {
  _synced: 0 | 1 | 2;
}

export interface NewFeatureDetail extends NewFeatureBase {
  // Extended detail fields can be added here when needed
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

interface CreateNewFeatureInput {
  orgId: string;
  title: string;
  createdBy: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export function createNewFeature(input: CreateNewFeatureInput): NewFeatureBase {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    orgId: input.orgId,
    title: input.title,
    description: input.description,
    status: NEW_FEATURE_STATUSES.DRAFT,
    version: 1,
    createdBy: input.createdBy,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}
