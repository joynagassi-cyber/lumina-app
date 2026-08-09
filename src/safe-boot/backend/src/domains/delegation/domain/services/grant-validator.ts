/**
 * GrantValidator — orchestrates all validation policies for grant creation.
 *
 * Encapsulates the validation logic that must be applied before creating or
 * modifying a grant. All business rules (BR-DEL-001 through BR-DEL-007) are
 * enforced through this validator.
 *
 * @traceability BR-DEL-001 to BR-DEL-007 — All validation rules aggregated here
 */

import { DurationPolicy } from '../policies/duration-policy';
import { NeverRepeatPolicy } from '../policies/never-repeat-policy';
import { NoSuperadminDelegation } from '../policies/no-superadmin-delegation';
import { NonTransitivePolicy, IDelegationQueryService } from '../policies/non-transitive-policy';
import { CapabilityManifest } from '../policies/capability-manifest-policy';
import { CircularDelegationError } from '../policies/delegation-errors';
import type { GrantPermission } from '../value-objects/grant-permission.vo';
import type { GrantScope } from '../value-objects/grant-scope.vo';

// Interface dependencies injected for testability
export interface IUserRoleService {
  getUserRole(orgId: string, userId: string): Promise<string | null>;
}

export class GrantValidator {
  /**
   * Validate all rules before creating a new grant.
   *
   * @param delegatorId — user requesting the delegation
   * @param delegateeId — user receiving the delegation
   * @param orgId — organization context
   * @param scope — delegation scope (org/group/branch/resource)
   * @param permissions — array of permission objects
   * @param durationDays — number of days for grant duration
   * @param userRoleService — service to check user roles
   * @param delegationQueryService — service to check delegation relationships
   * @throws Error if any validation rule is violated
   */
  static async validateCreateGrant(
    delegatorId: string,
    delegateeId: string,
    orgId: string,
    scope: GrantScope,
    permissions: GrantPermission[],
    durationDays: number,
    userRoleService: IUserRoleService,
    delegationQueryService: IDelegationQueryService,
  ): Promise<void> {
    // BR-DEL-001: Validate each permission against capability manifest
    for (const perm of permissions) {
      CapabilityManifest.validatePermission(perm.toString());
    }

    // BR-DEL-002: Validate duration (max 90 days)
    DurationPolicy.validateDuration(durationDays);

    // BR-DEL-003: Superadmin cannot be delegated
    await NoSuperadminDelegation.validate(
      delegatorId,
      delegateeId,
      orgId,
      userRoleService,
    );

    // Check for circular delegation
    await NeverRepeatPolicy.validateNoCircularDelegation(
      delegatorId,
      delegateeId,
      delegationQueryService,
    );

    // BR-DEL-007: Non-transitive — delegatee cannot re-delegate what was delegated to them
    await NonTransitivePolicy.validateNonTransitive(
      delegatorId,
      delegateeId,
      orgId,
      scope.value,
      delegationQueryService,
    );
  }

  /**
   * Validate revoke operation — grant must be active to be revoked.
   */
  static validateRevokeGrant(isActive: boolean): void {
    if (!isActive) {
      throw new Error('Only active grants can be revoked');
    }
  }
}