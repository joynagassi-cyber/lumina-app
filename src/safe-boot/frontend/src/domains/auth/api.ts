/**
 * Authentication Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate) - Auth operations
 * @traceability ASS-001: Application Services for auth operations (login, logout, mfa)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: user_sessions, mfa_configurations tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  AuthSession,
  CompleteMFASetupInput,
  GenerateRecoveryCodesInput,
  InitMFASetupInput,
  LoginInput,
  LogoutInput,
  VerifyMFAInput,
  VerifyRecoveryCodeInput,
  UserProfile,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchAuth<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Auth API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: async ({
    endpoint,
    method,
    body,
  }: {
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  }) => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: method ?? 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `API ${response.status}: ${errorBody || response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['Auth', 'Session'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    getMe: builder.query<UserProfile, void>({
      query: () => ({ endpoint: '/me', method: 'GET' }),
      providesTags: [{ type: 'Auth', id: 'PROFILE' }],
    }),

    getSessions: builder.query<ReadonlyArray<AuthSession>, string>({
      query: (userId) => ({ endpoint: `/users/${userId}/sessions`, method: 'GET' }),
      providesTags: (_result, _err, userId) => [{ type: 'Session', id: userId }],
    }),

    /* ---- Mutations ---- */

    login: builder.mutation<{ readonly profile: UserProfile; readonly session: AuthSession }, LoginInput>({
      query: (body) => ({ endpoint: '/auth/login', method: 'POST', body }),
      invalidatesTags: [{ type: 'Auth', id: 'PROFILE' }],
    }),

    logout: builder.mutation<void, LogoutInput>({
      query: (body) => ({ endpoint: '/auth/logout', method: 'POST', body }),
      invalidatesTags: [{ type: 'Session', id: 'ALL' }],
    }),

    refreshSession: builder.mutation<{ readonly accessToken: string; readonly refreshTokenHash: string }, void>({
      query: () => ({ endpoint: '/auth/refresh', method: 'POST' }),
      invalidatesTags: [{ type: 'Auth', id: 'SESSION' }],
    }),

    verifyMFA: builder.mutation<{ readonly sessionId: string; readonly accessToken: string }, VerifyMFAInput>({
      query: (body) => ({ endpoint: '/auth/mfa/verify', method: 'POST', body }),
    }),

    initMFASetup: builder.mutation<{ readonly setupId: string; readonly qrCode: string | null }, InitMFASetupInput>({
      query: (body) => ({ endpoint: '/auth/mfa/setup/init', method: 'POST', body }),
    }),

    completeMFASetup: builder.mutation<AuthSession, CompleteMFASetupInput>({
      query: (body) => ({ endpoint: '/auth/mfa/setup/complete', method: 'POST', body }),
      invalidatesTags: [{ type: 'Session', id: 'ALL' }],
    }),

    generateRecoveryCodes: builder.mutation<ReadonlyArray<string>, GenerateRecoveryCodesInput>({
      query: (body) => ({ endpoint: '/auth/mfa/recovery/generate', method: 'POST', body }),
    }),

    verifyRecoveryCode: builder.mutation<void, VerifyRecoveryCodeInput>({
      query: (body) => ({ endpoint: '/auth/mfa/recovery/verify', method: 'POST', body }),
    }),

    revokeSession: builder.mutation<void, string>({
      query: (sessionId) => ({
        endpoint: `/sessions/${sessionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Session', id: 'ALL' }],
    }),

    revokeAllSessions: builder.mutation<void, string>({
      query: (userId) => ({
        endpoint: `/users/${userId}/sessions/revoke-all`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, userId) => [{ type: 'Session', id: userId }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useRefreshSessionMutation,
  useVerifyMFAMutation,
  useInitMFASetupMutation,
  useCompleteMFASetupMutation,
  useGenerateRecoveryCodesMutation,
  useVerifyRecoveryCodeMutation,
  useRevokeSessionMutation,
  useRevokeAllSessionsMutation,
} = authApi;

export default authApi;