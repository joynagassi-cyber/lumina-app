export { useAuth as useUserAuth } from './useAuth';
export { useSync as useGlobalSync } from './useSync';
export { useOfflineStore } from './useOfflineStore';

// Domain hooks (per aggregate) — prefer these over global hooks when available
export { useOrganization, useActiveUnits } from '../domains/organization/hooks';
export { useAuth as useDomainAuth, usePermission } from '../domains/user/hooks';
export { useFinance, useApprovedTransactions } from '../domains/finance/hooks';
export { useSync as useDomainSync, useConflictStrategies, usePendingCount } from '../domains/sync/hooks';
