/**
 * User domain — value object re-exports
 */

export { EmailAddress } from './value-objects/email-address';
export type { RoleName } from './value-objects/user-role';
export { UserRole, ROLE_HIERARCHY, ADMIN_CREATEABLE_ROLES } from './value-objects/user-role';
export { PasswordHash } from './value-objects/password-hash';
export { PermissionGrant } from './value-objects/permission-grant';
export { PhoneNumber } from './value-objects/phone-number';
export { JWTToken } from './value-objects/jwt-token';
export { SessionContext } from './value-objects/session-context';
