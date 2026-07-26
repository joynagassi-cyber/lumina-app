/**
 * Feature Hot-Swap System — barrel export.
 *
 * Usage:
 *   import { HotSwapEngine, useHotSwapEngine } from '@/shared/feature-hot-swap';
 */

export type {
  FeatureModule,
  UnmountHandle,
  FeatureManifest,
  FeatureManifestEntry,
  FeatureRuntimeState,
  WorkflowHandle,
  DynamicRouteEntry,
} from './types';

export { HotSwapEngine, useHotSwapEngine } from './engine';
export {
  registerDynamicRoute,
  subscribeToWatermelon,
  invalidateWatermelonCacheForFeature,
  createWorkflowHandle,
  createFinanceLedgerModule,
} from './runtime-patches';
