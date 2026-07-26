/**
 * Redux store skeleton — RTK Query for API caching.
 * Per ITS-V1: single root reducer, domain slices created as needed.
 */

import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {
    // TODO: Add domain slices as they are implemented
    // auth: authSlice,
    // finance: financeSlice,
    // organization: organizationSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // WatermelonDB observables are not serializable
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
