/**
 * Redux store — RTK Query + domain slices.
 * Per ITS-V1: single root reducer, domain slices per aggregate.
 * Aggregates implemented: Organization, Identity/User, Finance, OfflineSync.
 */

import { configureStore } from '@reduxjs/toolkit';
import { organizationApi } from '../domains/organization/api';
import { userApi } from '../domains/user/api';
import { financeApi } from '../domains/finance/api';
import { syncApi } from '../domains/sync/api';
import orgReducer from '../domains/organization/store';
import authReducer from '../domains/user/store';
import financeReducer from '../domains/finance/store';
import syncReducer from '../domains/sync/store';

export const store = configureStore({
  reducer: {
    organization: orgReducer,
    auth: authReducer,
    finance: financeReducer,
    sync: syncReducer,
    [organizationApi.reducerPath]: organizationApi.reducer,
    [userApi.reducerPath]: userApi.reducer,
    [financeApi.reducerPath]: financeApi.reducer,
    [syncApi.reducerPath]: syncApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // WatermelonDB observables are not serializable
    }).concat(
      organizationApi.middleware,
      userApi.middleware,
      financeApi.middleware,
      syncApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
