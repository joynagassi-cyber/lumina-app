/**
 * NoSuperadminDelegation — prevents superadmin roles from being delegated (BR-DEL-003).
 *
 * Rule: Superadmin users cannot be either the delegator or the delegatee.
 * Superadmin is the highest privilege role and cannot be delegated.
 *
 * @traceability BR-DEL-003 — Superadmin cannot be delegated
 */

import { SuperadminDelegationError } from './delegation-errors';

export interface IUserRoleService {
  /** Get the role of a user within an organization. */
  getUserRole(orgId: string, userId: string): Promise<string | null>;
}

export class NoSuperadminDelegation {
  /**
   * Validate that neither the delegator nor the delegatee is a superadmin.
   *
   * @param delegatorId — the user who is delegating permissions
   * @param delegateeId — the user who is receiving permissions
   * @param orgId — the organization context
   * @param userRoleService — service to check user roles
   * @throws SuperadminDelegationError if either user is a superadmin
   */
  static async validate(
    delegatorId: string,
    delegateeId: string,
    orgId: string,
    userRoleService: IUserRoleService,
  ): Promise<void> {
    const delegatorRole = await userRoleService.getUserRole(orgId, delegatorId);
    const delegateeRole = await userRoleService.getUserRole(orgId, delegateeId);

    if (delegatorRole === 'superadmin') {
      throw new SuperadminDelegationError(
        'Superadmin cannot act as a delegator (BR-DEL-003)'
      );
    }

    if (delegateeRole === 'superadmin') {
      throw new SuperadminDelegationError(
        'Superadmin cannot be a delegatee (BR-DEL-003)'
      );
    }
  }
}