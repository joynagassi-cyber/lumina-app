/**
 * Authentication Domain — Redux slice for local auth state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability DOC-006: Identity concept — UserProfile + SessionContext
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AuthSession,
  UserProfile,
  DeviceInfo,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface AuthState {
  /** Current user profile. */
  profile: UserProfile | null;

  /** Whether authenticated. */
  isAuthenticated: boolean;

  /** Current user's sessions. */
  sessions: ReadonlyArray<AuthSession>;

  /** Currently selected session (if any). */
  selectedSession: AuthSession | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;

  /** MFA setup state (pending verification). */
  mfaPending: boolean;

  /** MFA verification identifier. */
  mfaIdentifier: string | null;
}

const initialState: AuthState = {
  profile: null,
  isAuthenticated: false,
  sessions: [],
  selectedSession: null,
  isLoading: false,
  error: null,
  mfaPending: false,
  mfaIdentifier: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<UserProfile | null>) {
      state.profile = action.payload;
      state.isAuthenticated = action.payload !== null;
      state.error = null;
    },

    setSessions(state, action: PayloadAction<ReadonlyArray<AuthSession>>) {
      state.sessions = [...action.payload];
    },

    addSession(state, action: PayloadAction<AuthSession>) {
      state.sessions = [...state.sessions, action.payload];
    },

    removeSession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.selectedSession?.id === action.payload) {
        state.selectedSession = null;
      }
    },

    setSelectedSession(state, action: PayloadAction<AuthSession | null>) {
      state.selectedSession = action.payload;
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    setMFAPending(state, action: PayloadAction<boolean>) {
      state.mfaPending = action.payload;
    },

    setMFAIdentifier(state, action: PayloadAction<string | null>) {
      state.mfaIdentifier = action.payload;
    },

    clearAuthState(state) {
      state.profile = null;
      state.isAuthenticated = false;
      state.sessions = [];
      state.selectedSession = null;
      state.isLoading = false;
      state.error = null;
      state.mfaPending = false;
      state.mfaIdentifier = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.isLoading = true;
          state.error = null;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled'),
        (state) => {
          state.isLoading = false;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action: { payload?: { message?: string } }) => {
          state.isLoading = false;
          state.error = action.payload?.message ?? 'Authentication failed';
        },
      );
  },
});

export const {
  setProfile,
  setSessions,
  addSession,
  removeSession,
  setSelectedSession,
  setLoading,
  setError,
  setMFAPending,
  setMFAIdentifier,
  clearAuthState,
} = authSlice.actions;

export default authSlice.reducer;