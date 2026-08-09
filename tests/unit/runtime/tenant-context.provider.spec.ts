/**
 * TenantContextProvider — specs CRT-015 (ADR-018).
 */

import { TenantContextProvider } from '../../../src/safe-boot/backend/src/core/runtime/tenant-context.provider';

describe('TenantContextProvider (CRT-015)', () => {
  const provider = new TenantContextProvider();

  it('runWithOrg propage l’org_id au contexte puis le restaure', () => {
    expect(provider.getOrgId()).toBeUndefined();

    const inside = provider.runWithOrg('org-42', () => provider.getOrgId());

    expect(inside).toBe('org-42');
    expect(provider.getOrgId()).toBeUndefined();
  });

  it('resolveFromJwt lit org_id depuis les claims JWT (jamais body/query)', () => {
    expect(provider.resolveFromJwt({ user: { org_id: 'org-7' } })).toBe('org-7');
    expect(provider.resolveFromJwt({ user: { orgId: 'org-8' } })).toBe('org-8');
    expect(provider.resolveFromJwt({ user: { org: 'org-9' } })).toBe('org-9');
    expect(provider.resolveFromJwt({})).toBeNull();
    expect(provider.resolveFromJwt(undefined)).toBeNull();
  });

  it('requireOrgId lève 401 si le tenant n’est pas résolu', () => {
    expect(() => provider.requireOrgId({})).toThrow('Tenant non résolu');
    expect(() => provider.requireOrgId()).toThrow('Tenant non résolu');
  });

  it('requireOrgId retourne l’org_id résolu depuis les claims', () => {
    expect(provider.requireOrgId({ user: { org_id: 'org-1' } })).toBe('org-1');
  });

  it('requireOrgId retourne l’org_id du contexte actif', () => {
    provider.runWithOrg('org-context', () => {
      expect(provider.requireOrgId()).toBe('org-context');
    });
  });
});
