/**
 * User/Auth Domain — custom React hooks for auth and user management.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability ASS-001: LoginUser, RefreshAccessToken, LogoutUser commands
 */

import { useCallback, useMemo } from 'react';
import type { PermissionResult, UserProfile } from './types';
import {
  useGetMeQuery,
  useCheckPermissionQuery,
  useLoginMutation,
  useRefreshSessionMutation,
  useLogoutMutation,
} from './api';

/* ------------------------------------------------------------------ */
/*  useAuth                                                            */
/* ------------------------------------------------------------------ */

export function useAuth() {
  const { data: profile, isLoading: loadingProfile } = useGetMeQuery(undefined, {
    skip: false,
  });
  const [login] = useLoginMutation();
  const [refresh] = useRefreshSessionMutation();
  const [logout] = useLogoutMutation();

  const profileData = profile as UserProfile | undefined;
  const isAuthenticated = profileData !== undefined && profileData.id.length > 0;

  return useMemo(
    () => ({
      profile: profileData ?? null,
      isAuthenticated,
      isLoading: loadingProfile,
      login: async (email: string, password: string) => login({ email, password }).unwrap(),
      refresh: async (refreshTokenHash: string) =>
        refresh({ refreshTokenHash }).unwrap(),
      logout: async (userId: string) => logout({ userId }).unwrap(),
    }),
    [profileData, isAuthenticated, loadingProfile, login, refresh, logout],
  );
}

/* ------------------------------------------------------------------ */
/*  usePermission                                                      */
/* ------------------------------------------------------------------ */

/**
 * Checks whether the current user has a permission grant for the given
 * resource ID and action. Returns cached result if available.
 */
export function usePermission(resourceId: string, action: string) {
  const { data, isLoading } = useCheckPermissionQuery(
    { resourceId, action },
    { skip: !resourceId || !action },
  );

  const result = data as PermissionResult | undefined;

  return useMemo(
    () => ({
      granted: result?.granted ?? false,
      matchedGrant: result?.matchedGrant ?? null,
      isLoading,
    }),
    [result?.granted, result?.matchedGrant, isLoading],
  );
}
