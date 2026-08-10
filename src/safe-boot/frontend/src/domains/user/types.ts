/**
 * User/Auth Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability DOC-006: Identity concept + PermissionGrant VO
 * @traceability ASS-001: Application Services for auth operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Built-in role enum per BR-ID-005 hierarchy constraint.
 * Source: CANONICAL-DOMAIN-MODEL.md UserRole VO.
 */
export type UserRole = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';

/**
 * Permission grant string in resource:action:level format.
 * Wildcard ["*"] is auditable but allowed (BR-ID-006).
 */
export type PermissionGrant = string;

/**
 * Supported resource types for permission grants.
 */
export type ResourceScope =
  | 'organization'
  | 'user'
  | 'transaction'
  | 'member'
  | 'event'
  | 'group'
  | 'report'
  | '*';

/**
 * Supported action types for permission grants.
 */
export type PermissionAction =
  | 'read'
  | 'write'
  | 'approve'
  | 'revoke'
  | 'export'
  | '*';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * UserProfile entity from IdentityAggregate.
 * Maps to physical table `users` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface UserProfile {
  /** Unique identifier. */
  readonly id: string;

  /** First name of the user. */
  readonly firstName: string;

  /** Last name of the user. */
  readonly lastName: string;

  /** Email address — unique within org per BR-ID-003. */
  readonly email: string;

  /** Phone number (optional). */
  readonly phone: string | null;

  /** The user's built-in role determining permission grant scope. */
  readonly role: UserRole;

  /** Organization this user belongs to (enforced by visibility policy). */
  readonly organizationId: string;

  /** Avatar URL or null if none set. */
  readonly avatarUrl: string | null;

  /** Whether the profile is fully verified. */
  readonly isVerified: boolean;

  /** Timestamp when last logged in (nullable). */
  readonly lastLoginAt: string | null;

  /** Timestamp of creation. */
  readonly createdAt: string;

  /** Timestamp of last update. */
  readonly updatedAt: string;
}

/**
 * Authentication session context maintained after login.
 * JWT tokens are ephemeral and never stored plain (BR-ID-002).
 */
export interface SessionContext {
  /** Short-lived access token (JWT). Never persisted to disk plain. */
  readonly accessToken: string;

  /** Refresh token hash stored in expo-secure-store (BR-ID-002). */
  readonly refreshTokenHash: string;

  /** When the access token expires (UTC ISO 8601). */
  readonly expiresAt: string;

  /** Whether this session is currently active. */
  readonly isActive: boolean;

  /** Device identification info for session tracking. */
  readonly deviceInfo: DeviceInfo;
}

/**
 * Device information used for session audit trail.
 */
export interface DeviceInfo {
  /** Platform identifier: ios, android, web. */
  readonly platform: 'ios' | 'android' | 'web';

  /** Device model string. */
  readonly model: string;

  /** Application version string. */
  readonly appVersion: string;
}

/**
 * Permission evaluation result.
 */
export interface PermissionResult {
  /** Whether the grant covers the requested resource + action. */
  readonly granted: boolean;

  /** The specific grant pattern that matched, or null. */
  readonly matchedGrant: PermissionGrant | null;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for LoginUser command.
 * Maps to ASS-001 LoginUser operation.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Input for CreateUser command (admin/superadmin only).
 */
export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  password: string;
}

/**
 * Input for UpdateUserProfile command.
 */
export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Aggregated structure returned by useAuth().
 */
export interface AuthDomainModel {
  readonly profile: UserProfile | null;
  readonly session: SessionContext | null;
  readonly isAuthenticated: boolean;
}

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}
