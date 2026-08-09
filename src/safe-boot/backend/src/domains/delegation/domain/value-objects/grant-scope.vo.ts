/**
 * GrantScope — defines the scope of a delegated capability.
 *
 * The scope determines what resource or context the delegation applies to.
 * Per BR-DEL-001, each permission within the grant must be validated against
 * the capability manifest within the appropriate scope.
 *
 * @traceability DOC-012 DelegationAggregate → GrantScope VO
 */

export type GrantScopeValue = 'org' | 'group' | 'branch' | 'resource';

export class GrantScope {
  constructor(public readonly value: GrantScopeValue) {}

  static create(scope: GrantScopeValue): GrantScope {
    if (!['org', 'group', 'branch', 'resource'].includes(scope)) {
      throw new Error(`Invalid GrantScope: ${scope}. Must be one of: org, group, branch, resource`);
    }
    return new GrantScope(scope);
  }

  toString(): string {
    return this.value;
  }
}