/**
 * Authentication Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability ASS-001: Application Services for auth operations
 */

import { useState, useCallback, useMemo } from 'react';
import type { UserProfile, AuthSession, DeviceInfo, MFAMethod } from './types';
import {
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useRefreshSessionMutation,
  useInitMFASetupMutation,
  useCompleteMFASetupMutation,
} from './api';

/* ------------------------------------------------------------------ */
/*  useAuth                                                            */
/* ------------------------------------------------------------------ */

/**
 * Provides authentication state and utilities.
 * Maps to BR-ID token handling policies.
 */
export function useAuth() {
  const { data: profile, isLoading: loadingProfile, error: profileError } = useGetMeQuery(undefined, {
    skip: false,
  });

  const [login] = useLoginMutation();
  const [logout] = useLogoutMutation();
  const [refresh] = useRefreshSessionMutation();

  const profileData = profile as UserProfile | undefined;
  const isAuthenticated = !!profileData && profileData.id.length > 0;

  return useMemo(() => ({
    profile: profileData ?? null,
    isAuthenticated,
    isLoading: loadingProfile,
    error: profileError,
    login: async (email: string, password: string, organizationId?: string) => {
      return await login({ email, password, organizationId }).unwrap();
    },
    logout: async () => {
      await logout({}).unwrap();
    },
    refresh: async () => {
      try {
        return await refresh().unwrap();
      } catch (err) {
        // Refresh failed, clear session
        await logout({});
        throw err;
      }
    },
    getAccessToken: async (): Promise<string | null> => {
      // In a real implementation, this would retrieve from secure storage
      return null;
    },
  }), [profileData, isAuthenticated, loadingProfile, profileError, login, logout, refresh]);
}

/* ------------------------------------------------------------------ */
/*  useLogin                                                           */
/* ------------------------------------------------------------------ */

/**
 * Login hook with MFA handling.
 */
export function useLogin() {
  const [loginMut, { isLoading: loadingLogin, error: loginError }] = useLoginMutation();
  const [isMFARequired, setIsMFARequired] = useState(false);
  const [mfaContext, setMFAContext] = useState<{ identifier: string; method: string } | null>(null);

  const handleLogin = async (email: string, password: string, organizationId?: string) => {
    try {
      const result = await loginMut({ email, password, organizationId }).unwrap();

      // If MFA is required, return context for MFA flow
      if (result.session.requiresMFA) {
        setIsMFARequired(true);
        setMFAContext({
          identifier: result.session.id || email,
          method: 'totp',
        });
        return { ...result, mfaRequired: true };
      }

      return result;
    } catch (err) {
      throw err;
    }
  };

  const handleMFACode = async (code: string) => {
    if (!mfaContext) throw new Error('No MFA context');
    // Implement MFA verification using verifyMFA mutation
    // This would call the verifyMFA endpoint with the code
    throw new Error('MFA verification not implemented in this hook');
  };

  const clearMFAContext = () => {
    setIsMFARequired(false);
    setMFAContext(null);
  };

  return useMemo(() => ({
    login: handleLogin,
    handleMFACode,
    clearMFAContext,
    isMFARequired,
    mfaContext,
    isLoading: loadingLogin,
    error: loginError,
    loading: loadingLogin,
  }), [handleLogin, mfaContext, isMFARequired, loadingLogin, loginError]);
}

/* ------------------------------------------------------------------ */
/*  useLogout                                                          */
/* ------------------------------------------------------------------ */

/**
 * Logout hook.
 */
export function useLogout() {
  const [logoutMut, { isLoading: loadingLogout, error: logoutError }] = useLogoutMutation();

  const execute = async () => {
    try {
      await logoutMut({}).unwrap();
    } catch (err) {
      throw err;
    }
  };

  return useMemo(() => ({
    logout: execute,
    isLoading: loadingLogout,
    error: logoutError,
    loading: loadingLogout,
  }), [execute, loadingLogout, logoutError]);
}

/* ------------------------------------------------------------------ */
/*  useMfaSetup                                                        */
/* ------------------------------------------------------------------ */

/**
 * MFA setup hook for TOTP/QR code configuration.
 */
export function useMFASetup() {
  const [initSetup, { isLoading: loadingInit, error: initError }] = useInitMFASetupMutation();
  const [completeSetup, { isLoading: loadingComplete, error: completeError }] = useCompleteMFASetupMutation();

  const initialize = async (method: MFAMethod = 'totp') => {
    try {
      return await initSetup({ method }).unwrap();
    } catch (err) {
      throw err;
    }
  };

  const complete = async (setupId: string, code: string) => {
    try {
      return await completeSetup({ setupId, code }).unwrap();
    } catch (err) {
      throw err;
    }
  };

  return useMemo(() => ({
    initialize,
    complete,
    isLoading: loadingInit || loadingComplete,
    error: initError || completeError,
    loading: loadingInit || loadingComplete,
  }), [initialize, complete, loadingInit, loadingComplete, initError, completeError]);
}