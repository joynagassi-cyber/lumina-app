/**
 * Session Policy — enforces session lifecycle rules per IdentityAggregate specification
 *
 * Rules:
 * - Max concurrent sessions per user: configurable (default 10)
 * - Session idle timeout: no automatic expiry (explicit revocation required)
 * - Required fields: user_id, org_id, refresh_token_hash (hashed), expires_at, device_info
 * - Session cannot exist without valid org_id scoping (BR-ORG-004)
 *
 * @traceability DOC-012 BR-ID-003 email uniqueness scope → session scoped to org
 *   → PG-Schema Table 5 org_id column
 */

export interface SessionPolicyParams {
  maxConcurrentSessions?: number;
}

export class SessionPolicy {
  private readonly _maxConcurrent: number;

  constructor(params: SessionPolicyParams = {}) {
    this._maxConcurrent = params.maxConcurrentSessions ?? 10;
  }

  get maxConcurrentSessions(): number { return this._maxConcurrent; }

  /** Validate that the device info is a plain object. */
  validateDeviceInfo(deviceInfo: unknown): void {
    if (deviceInfo === null || typeof deviceInfo !== 'object' || Array.isArray(deviceInfo)) {
      throw new Error('DeviceInfo must be a non-null object');
    }
  }

  /** Validate org_id is a non-empty string. */
  validateOrgId(orgId: string): void {
    if (!orgId || orgId.length < 1) {
      throw new Error('org_id must be a non-empty string');
    }
  }

  /** Check if the given count of active sessions is within the policy limit. */
  canCreateSession(currentActiveCount: number): boolean {
    return currentActiveCount < this._maxConcurrent;
  }
}

export const DEFAULT_SESSION_POLICY = new SessionPolicy();
