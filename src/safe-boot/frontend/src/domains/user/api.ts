/**
 * User/Auth Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability ASS-001: Application Services for auth CRUD operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: users physical table
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CreateUserInput,
  LoginInput,
  PaginatedResponse,
  PermissionResult,
  UserProfile,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function authFetch<T>(
  endpoint: string,
  options?: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<{ data: T } | { error: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Auth tokens would be attached here via a middleware or interceptor pattern.
  // The accessToken is read from secure storage at the hooks layer.
  return fetch(`${BASE_URL}${endpoint}`, {
    method: options?.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options?.body ? JSON.stringify(options.body) : undefined,
  }).then(async (response) => {
    if (!response.ok) {
      return {
        error: `Auth API error: ${response.status} ${response.statusText}`,
      };
    }
    return { data: (await response.json()) as T };
  });
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const userApi = createApi({
  reducerPath: 'userApi',
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
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return { error: `User API error: ${response.status} ${response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['User', 'Session'],
  endpoints: (builder) => ({
    /* ---- Auth Queries/Mutations ---- */

    login: builder.mutation<
      { profile: UserProfile; sessionToken: string },
      LoginInput
    >({
      query: (body) => ({ endpoint: '/auth/login', method: 'POST', body }),
      invalidatesTags: [{ type: 'User', id: 'CURRENT' }],
    }),

    refreshSession: builder.mutation<
      { sessionToken: string },
      { refreshTokenHash: string }
    >({
      query: (body) => ({ endpoint: '/auth/refresh', method: 'POST', body }),
    }),

    logout: builder.mutation<void, { userId: string }>({
      query: ({ userId }) => ({ endpoint: `/auth/logout`, method: 'POST', body: { userId } }),
      invalidatesTags: [{ type: 'Session', id: 'ALL' }],
    }),

    getMe: builder.query<UserProfile, void>({
      query: () => ({ endpoint: '/auth/me', method: 'GET' }),
      providesTags: [{ type: 'User', id: 'CURRENT' }],
    }),

    checkPermission: builder.query<PermissionResult, { resourceId: string; action: string }>({
      query: ({ resourceId, action }) => ({
        endpoint: `/auth/permission?resource=${resourceId}&action=${action}`,
        method: 'GET',
      }),
    }),

    /* ---- User CRUD ---- */

    getUserProfile: builder.query<UserProfile, string>({
      query: (userId) => ({ endpoint: `/users/${userId}`, method: 'GET' }),
      providesTags: (_result, _err, userId) => [{ type: 'User', id: userId }],
    }),

    listUsers: builder.query<PaginatedResponse<UserProfile>, string>({
      query: (orgId) => ({ endpoint: `/users?org_id=${orgId}`, method: 'GET' }),
      providesTags: [{ type: 'User', id: 'LIST' }],
    }),

    createUser: builder.mutation<UserProfile, CreateUserInput>({
      query: (body) => ({ endpoint: '/users', method: 'POST', body }),
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),

    updateUserProfile: builder.mutation<
      UserProfile,
      { userId: string } & Partial<CreateUserInput>
    >({
      query: ({ userId, ...body }) => ({
        endpoint: `/users/${userId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'User', id: arg.userId },
      ],
    }),

    changeUserRole: builder.mutation<
      UserProfile,
      { userId: string; newRole: 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff' }
    >({
      query: ({ userId, newRole }) => ({
        endpoint: `/users/${userId}/role`,
        method: 'PATCH',
        body: { newRole },
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'User', id: arg.userId },
      ],
    }),

    resetPassword: builder.mutation<
      void,
      { userId: string }
    >({
      query: ({ userId }) => ({
        endpoint: `/users/${userId}/reset-password`,
        method: 'POST',
      }),
    }),

    revokeSession: builder.mutation<void, { userId: string; sessionId: string }>({
      query: ({ userId, sessionId }) => ({
        endpoint: `/users/${userId}/sessions/${sessionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Session', id: 'ALL' }],
    }),

    assignPermissionGrant: builder.mutation<
      UserProfile,
      { userId: string; grant: string }
    >({
      query: ({ userId, grant }) => ({
        endpoint: `/users/${userId}/permissions`,
        method: 'POST',
        body: { grant },
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'User', id: arg.userId },
      ],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useLoginMutation,
  useRefreshSessionMutation,
  useLogoutMutation,
  useGetMeQuery,
  useCheckPermissionQuery,
  useGetUserProfileQuery,
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserProfileMutation,
  useChangeUserRoleMutation,
  useResetPasswordMutation,
  useRevokeSessionMutation,
  useAssignPermissionGrantMutation,
} = userApi;

export default userApi;
