/**
 * Auth/User Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 */

export type {
  AuthDomainModel,
  CreateUserInput,
  DeviceInfo,
  LoginInput,
  PermissionAction,
  PermissionGrant,
  PermissionResult,
  ResourceScope,
  SessionContext,
  UpdateUserProfileInput,
  UserProfile,
  UserRole,
} from './types';

export {
  userApi,
  useAssignPermissionGrantMutation,
  useChangeUserRoleMutation,
  useCheckPermissionQuery,
  useCreateUserMutation,
  useGetMeQuery,
  useGetUserProfileQuery,
  useListUsersQuery,
  useLoginMutation,
  useLogoutMutation,
  useRefreshSessionMutation,
  useRevokeSessionMutation,
  useResetPasswordMutation,
  useUpdateUserProfileMutation,
} from './api';

export { default as authReducer } from './store';

export { useAuth, usePermission } from './hooks';

export { getUserSchema } from './watermelon';

export { LoginForm } from './components';
