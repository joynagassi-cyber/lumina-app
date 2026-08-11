/**
 * Authentication Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate) - Auth operations
 * @traceability DOC-006: Identity concept + SessionContext
 * @traceability ASS-001: Application Services for auth operations (login, logout, mfa)
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Authentication session state.
 */
export type SessionState = 'active' | 'revoked' | 'expired';

/**
 * MFA method type.
 */
export type MFAMethod = 'totp' | 'sms' | 'email' | 'backup_code';

/**
 * Login factor requirement.
 */
export type LoginFactor = 'password' | 'mfa';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * Authentication session.
 * Maps to physical table `user_sessions` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface AuthSession {
  /** Universally unique identifier for this session. */
  readonly id: string;

  /** User ID associated with this session. */
  readonly userId: string;

  /** Organization ID (if session is org-scoped). */
  readonly organizationId: string | null;

  /** Access token (JWT). */
  readonly accessToken: string;

  /** Refresh token hash (stored securely). */
  readonly refreshTokenHash: string;

  /** Session expiry timestamp (UTC ISO 8601). */
  readonly expiresAt: string;

  /** Device information. */
  readonly deviceInfo: DeviceInfo;

  /** IP address of the client. */
  readonly ipAddress: string | null;

  /** User agent string. */
  readonly userAgent: string | null;

  /** Session state. */
  readonly state: SessionState;

  /** Whether the session requires MFA. */
  readonly requiresMFA: boolean;

  /** Last activity timestamp (UTC ISO 8601). */
  readonly lastActivityAt: string;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * Device information for session tracking.
 */
export interface DeviceInfo {
  /** Platform identifier: ios, android, web. */
  readonly platform: 'ios' | 'android' | 'web';

  /** Device model string. */
  readonly model: string;

  /** Application version string. */
  readonly appVersion: string;

  /** Build number. */
  readonly build: string;
}

/**
 * MFA setup configuration.
 */
export interface MFASetup {
  /** Universally unique identifier for this MFA setup. */
  readonly id: string;

  /** User ID. */
  readonly userId: string;

  /** Method used (totp, sms, email, backup_code). */
  readonly method: MFAMethod;

  /** Whether this MFA method is enabled. */
  readonly isEnabled: boolean;

  /** Setup completion status. */
  readonly status: 'pending' | 'completed' | 'failed';

  /** QR code data (for TOTP). */
  readonly qrCode: string | null;

  /** Recovery codes (encrypted). */
  readonly recoveryCodes: string[] | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for Login command.
 */
export interface LoginInput {
  /** Email address (required). */
  readonly email: string;

  /** Password (required). */
  readonly password: string;

  /** Organization ID (optional, for org-specific login). */
  readonly organizationId?: string;

  /** Remember me (default: false). */
  readonly rememberMe?: boolean;
}

/**
 * Input for VerifyMFA command.
 */
export interface VerifyMFAInput {
  /** Session ID or user ID. */
  readonly identifier: string;

  /** MFA code (required). */
  readonly code: string;

  /** Method used (required). */
  readonly method: MFAMethod;
}

/**
 * Input for Logout command.
 */
export interface LogoutInput {
  /** Session ID to revoke (all if not provided). */
  readonly sessionId?: string;

  /** Whether to clear all sessions (default: false). */
  readonly clearAll?: boolean;
}

/**
 * Input for InitMFASetup command.
 */
export interface InitMFASetupInput {
  /** User ID (defaults to current user). */
  readonly userId?: string;

  /** Method to initialize (default: totp). */
  readonly method?: MFAMethod;
}

/**
 * Input for CompleteMFASetup command.
 */
export interface CompleteMFASetupInput {
  /** Setup ID. */
  readonly setupId: string;

  /** MFA verification code. */
  readonly code: string;
}

/**
 * Input for GenerateRecoveryCodes command.
 */
export interface GenerateRecoveryCodesInput {
  /** User ID. */
  readonly userId: string;
}

/**
 * Input for VerifyRecoveryCode command.
 */
export interface VerifyRecoveryCodeInput {
  /** User ID. */
  readonly userId: string;

  /** Recovery code. */
  readonly code: string;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Authentication domain model (aggregated view).
 */
export interface AuthDomainModel {
  /** Current user profile. */
  readonly profile: UserProfile | null;

  /** Active sessions. */
  readonly sessions: ReadonlyArray<AuthSession>;

  /** Whether authenticated. */
  readonly isAuthenticated: boolean;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * MFA setup state.
 */
export interface MFASetupState {
  /** Current MFA setup status. */
  readonly status: 'not_setup' | 'pending' | 'completed';

  /** Available methods. */
  readonly availableMethods: ReadonlyArray<MFAMethod>;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  User Profile (shared with user domain but used by auth)            */
/* ------------------------------------------------------------------ */

/**
 * UserProfile — shared with identity domain.
 */
export interface UserProfile {
  /** Unique identifier. */
  readonly id: string;

  /** First name. */
  readonly firstName: string;

  /** Last name. */
  readonly lastName: string;

  /** Email address. */
  readonly email: string;

  /** Phone number (optional). */
  readonly phone: string | null;

  /** Role. */
  readonly role: UserRole;

  /** Organization ID. */
  readonly organizationId: string;

  /** Avatar URL (optional). */
  readonly avatarUrl: string | null;

  /** Whether the profile is verified. */
  readonly isVerified: boolean;

  /** Last login at (nullable). */
  readonly lastLoginAt: string | null;

  /** Timestamp of creation. */
  readonly createdAt: string;

  /** Timestamp of last update. */
  readonly updatedAt: string;
}

/**
 * Built-in role enum per BR-ID-005 hierarchy constraint.
 */
export type UserRole = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the AuthSession WatermelonDB model.
 */
export interface AuthSessionAttrs {
  id: string;
  _updatedAt: number;
  userId: string;
  organizationId: string | null;
  accessToken: string; // Typically stored encrypted/hashed
  refreshTokenHash: string;
  expiresAt: string;
  deviceInfo: string; // JSON serialized
  ipAddress: string | null;
  userAgent: string | null;
  state: SessionState;
  requiresMFA: boolean;
  lastActivityAt: string;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Attributes for the MFASetup WatermelonDB model.
 */
export interface MFASetupAttrs {
  id: string;
  _updatedAt: number;
  userId: string;
  method: MFAMethod;
  isEnabled: boolean;
  status: 'pending' | 'completed' | 'failed';
  qrCode: string | null;
  recoveryCodes: string; // JSON serialized
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}