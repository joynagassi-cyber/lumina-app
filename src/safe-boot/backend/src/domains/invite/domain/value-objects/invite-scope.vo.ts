/**
 * InviteScope — Scope of the invitation (org, group, branch, team, etc.)
 *
 * Defines the organizational boundary where the invitation grants access.
 */

export const InviteScope = {
  ORG: 'org',
  GROUP: 'group',
  BRANCH: 'branch',
  TEAM: 'team',
  PROJECT: 'project',
  CUSTOMER: 'customer',
  CLIENT: 'client',
  ALL: '*',
} as const;

export type InviteScope = typeof InviteScope[keyof typeof InviteScope];

/**
 * Validates if a scope string is a valid invite scope.
 */
export function isValidScope(scope: unknown): scope is InviteScope {
  return typeof scope === 'string' && Object.values(InviteScope).includes(scope as InviteScope);
}