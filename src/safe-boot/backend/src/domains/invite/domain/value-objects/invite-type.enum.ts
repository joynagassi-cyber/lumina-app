/**
 * InviteType — Classification of invitation approval workflows
 *
 * Types:
 *   auto       → No approval required, direct acceptance on token use
 *   approval_required → Requires admin/system approval before membership creation
 *   owner_validation → Requires organization owner validation
 *   standard   → Default type, single-use token with auto-accept on usage
 */

export const InviteType = {
  AUTO: 'auto',
  APPROVAL_REQUIRED: 'approval_required',
  OWNER_VALIDATION: 'owner_validation',
  STANDARD: 'standard',
} as const;

export type InviteType = typeof InviteType[keyof typeof InviteType];

/**
 * Validates if an invite type is allowed for the given scope.
 */
export function isInviteTypeAllowedForScope(
  type: InviteType,
  scope: string
): boolean {
  // Owner validation typically for org-level scopes
  if (scope === 'org' && type === InviteType.OWNER_VALIDATION) {
    return true;
  }
  // Auto approval for group member additions
  if ((scope === 'group' || scope === 'branch') && type === InviteType.AUTO) {
    return true;
  }
  // Standard and approval_required are universally allowed
  return true;
}