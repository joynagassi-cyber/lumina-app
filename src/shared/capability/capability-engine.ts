/**
 * Capability / Permission Engine — role × org × resource access control and
 * feature toggles, driven by the compiled Org Manifest.
 *
 * Canonical sources: ADR-001 (Capability Engine — registry of activatable
 * features), DOC-000 (Platform Capabilities layer), CAPABILITY-DEPENDENCY-GRAPH,
 * RTS-001 (AuthorizationPort). Permissions and feature toggles are NEVER
 * hardcoded in code (INV-005: manifest > hardcoded code).
 */
import type { FeatureEntry, OrgManifest, RoleDefinition } from '../manifest/types';

export class CapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityError';
  }
}

export interface FeatureAccess {
  available: boolean;
  reason: 'enabled' | 'disabled' | 'missing-permission';
  missingPermissions: string[];
}

export class CapabilityEngine {
  private readonly roles: Map<string, RoleDefinition>;
  private readonly features: Map<string, FeatureEntry>;
  /** '*' is the universal wildcard — matches any permission. */
  static readonly WILDCARD = '*';

  constructor(manifest: OrgManifest) {
    this.roles = new Map(manifest.permissions.roles.map((r) => [r.name, r]));
    this.features = new Map(manifest.features.map((f) => [f.id, f]));
  }

  static fromManifest(manifest: OrgManifest): CapabilityEngine {
    return new CapabilityEngine(manifest);
  }

  hasRole(roleName: string): boolean {
    return this.roles.has(roleName);
  }

  /** Effective permission set for one role — expands the '*' wildcard. */
  effectivePermissions(roleName: string): Set<string> {
    const role = this.roles.get(roleName);
    if (!role) return new Set();
    if (role.permissions.includes(CapabilityEngine.WILDCARD)) {
      return new Set([CapabilityEngine.WILDCARD]);
    }
    return new Set(role.permissions);
  }

  /**
   * Does a single role grant a permission? A role with '*' grants everything.
   * Unknown role or permission → false (fail closed, DR-009 spirit).
   */
  roleCan(roleName: string, permission: string): boolean {
    const perms = this.effectivePermissions(roleName);
    return perms.has(CapabilityEngine.WILDCARD) || perms.has(permission);
  }

  /**
   * Does ANY of the user's roles grant the permission? Throws CapabilityError
   * when the role list contains an unknown role (configuration problem) —
   * validated upfront so the error surfaces regardless of permission outcome.
   */
  can(roles: string[], permission: string): boolean {
    for (const role of roles) {
      if (!this.roles.has(role)) {
        throw new CapabilityError(`Rôle inconnu: "${role}"`);
      }
    }
    for (const role of roles) {
      if (this.roleCan(role, permission)) return true;
    }
    return false;
  }

  /** can() that throws CapabilityError with a clear message on denial. */
  requirePermission(roles: string[], permission: string): void {
    if (!this.can(roles, permission)) {
      throw new CapabilityError(
        `Permission refusée: "${permission}" (rôles: ${roles.join(', ') || 'aucun'})`,
      );
    }
  }

  /** Effective union of permissions across several roles. */
  unionPermissions(roles: string[]): Set<string> {
    const union = new Set<string>();
    for (const role of roles) {
      if (!this.roles.has(role)) {
        throw new CapabilityError(`Rôle inconnu: "${role}"`);
      }
      const perms = this.effectivePermissions(role);
      if (perms.has(CapabilityEngine.WILDCARD)) {
        return new Set([CapabilityEngine.WILDCARD]);
      }
      for (const p of perms) union.add(p);
    }
    return union;
  }

  isFeatureEnabled(featureId: string): boolean {
    return this.features.get(featureId)?.enabled ?? false;
  }

  getFeature(featureId: string): FeatureEntry | undefined {
    return this.features.get(featureId);
  }

  /** All feature ids declared in the manifest. */
  featureIds(): string[] {
    return [...this.features.keys()];
  }

  /**
   * Full feature access check: the toggle must be on AND the user's roles must
   * cover every required permission. Returns a structured verdict instead of
   * throwing, so the UI can render a disabled state.
   */
  checkFeatureAccess(featureId: string, roles: string[]): FeatureAccess {
    const feature = this.features.get(featureId);
    if (!feature) {
      return { available: false, reason: 'disabled', missingPermissions: [] };
    }
    if (!feature.enabled) {
      return { available: false, reason: 'disabled', missingPermissions: [] };
    }
    const missing = feature.requiredPermissions.filter((p) => !this.can(roles, p));
    if (missing.length > 0) {
      return { available: false, reason: 'missing-permission', missingPermissions: missing };
    }
    return { available: true, reason: 'enabled', missingPermissions: [] };
  }

  /** Feature must be enabled AND permitted — throws CapabilityError otherwise. */
  requireFeature(featureId: string, roles: string[]): void {
    const access = this.checkFeatureAccess(featureId, roles);
    if (!access.available) {
      throw new CapabilityError(
        `Fonctionnalité "${featureId}" indisponible: ${access.reason}${
          access.missingPermissions.length ? ` (manque: ${access.missingPermissions.join(', ')})` : ''
        }`,
      );
    }
  }
}
