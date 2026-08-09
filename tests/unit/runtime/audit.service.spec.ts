/**
 * RuntimeAuditService — specs CRT-014 (ADR-018).
 */

import { RuntimeAuditService } from '../../../src/safe-boot/backend/src/core/runtime/audit.service';
import { TenantContextProvider } from '../../../src/safe-boot/backend/src/core/runtime/tenant-context.provider';

describe('RuntimeAuditService (CRT-014)', () => {
  const tenant = new TenantContextProvider();
  let prisma: { auditEntry: { create: jest.Mock } };

  beforeEach(() => {
    prisma = {
      auditEntry: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };
  });

  it('écrit une entrée AuditEntry avec valeurs avant/après (OLDNEW-002)', async () => {
    const service = new RuntimeAuditService(prisma as never, tenant);

    await service.log({
      action: 'transaction_created',
      entityType: 'Transaction',
      entityId: 'tx-1',
      before: { status: 'pending' },
      after: { status: 'done' },
    });

    expect(prisma.auditEntry.create).toHaveBeenCalledTimes(1);
    const data = prisma.auditEntry.create.mock.calls[0][0].data;
    expect(data.action_effectuee).toBe('transaction_created');
    expect(data.entite_type).toBe('Transaction');
    expect(data.entite_id).toBe('tx-1');
    expect(data.valeur_avant).toEqual({ status: 'pending' });
    expect(data.valeur_apres).toEqual({ status: 'done' });
  });

  it('est NON-BLOQUANT (AUD-001) : une erreur d’écriture ne lève jamais', async () => {
    prisma.auditEntry.create.mockRejectedValue(new Error('db down'));
    const service = new RuntimeAuditService(prisma as never, tenant);

    await expect(service.log({ action: 'a', entityType: 'B' })).resolves.toBeUndefined();
  });

  it('utilise l’org_id du contexte tenant (INV-004)', async () => {
    const service = new RuntimeAuditService(prisma as never, tenant);

    await tenant.runWithOrg('org-99', () =>
      service.log({ action: 'a', entityType: 'B' }),
    );

    const data = prisma.auditEntry.create.mock.calls[0][0].data;
    expect(data.org_id).toBe('org-99');
  });

  it('utilise un uuid nul quand aucun tenant n’est résolu (champs requis Prisma)', async () => {
    const service = new RuntimeAuditService(prisma as never, tenant);

    await service.log({ action: 'a', entityType: 'B' });

    const data = prisma.auditEntry.create.mock.calls[0][0].data;
    expect(data.org_id).toBe('00000000-0000-0000-0000-000000000000');
  });
});
