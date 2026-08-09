/**
 * AuditInterceptor — specs CRT-014 (ADR-018).
 *
 * Les handlers sont marqués via Reflect.defineMetadata(AUDIT_METADATA_KEY)
 * (équivalent de l'annotation @Audit) pour éviter la syntaxe décorateur
 * dans la spec.
 */

import 'reflect-metadata';
import { lastValueFrom, of, throwError } from 'rxjs';

import { AuditInterceptor } from '../../../src/safe-boot/backend/src/core/runtime/audit-interceptor';
import { AUDIT_METADATA_KEY } from '../../../src/safe-boot/backend/src/core/runtime/audit.decorator';

describe('AuditInterceptor (CRT-014)', () => {
  let audit: { log: jest.Mock };
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(audit as never);
  });

  function markAudited(handler: (...args: unknown[]) => unknown, action: string, entityType: string) {
    Reflect.defineMetadata(
      AUDIT_METADATA_KEY,
      { action, entityType },
      handler,
    );
  }

  function contextFor(
    handler: (...args: unknown[]) => unknown,
    request: { body?: unknown; ip?: string; user?: { sub?: string } } = { body: { amount: 10 } },
  ) {
    return {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  }

  it('audite un handler marqué @Audit avec état avant/après (OLDNEW-002)', async () => {
    const handler = () => ({ id: 'p-1' });
    markAudited(handler, 'payment_captured', 'Payment');

    const observable = interceptor.intercept(
      contextFor(handler),
      { handle: () => of({ id: 'p-1' }) } as never,
    );
    await lastValueFrom(observable as never);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_captured',
        entityType: 'Payment',
        before: { amount: 10 },
        after: { id: 'p-1' },
      }),
    );
  });

  it('n’audite PAS un handler sans annotation (NB-PERSIST-007 — jamais d’auto-audit)', async () => {
    const handler = () => 'ok';

    const observable = interceptor.intercept(
      contextFor(handler),
      { handle: () => of('ok') } as never,
    );
    await lastValueFrom(observable as never);

    expect(audit.log).not.toHaveBeenCalled();
  });

  it('logue l’erreur sur échec sans faire échouer le flux', async () => {
    const handler = () => {
      throw new Error('boom');
    };
    markAudited(handler, 'payment_failed', 'Payment');

    const observable = interceptor.intercept(
      contextFor(handler),
      { handle: () => throwError(() => new Error('boom')) } as never,
    );

    await expect(lastValueFrom(observable as never)).rejects.toThrow('boom');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_failed',
        after: expect.objectContaining({ error: 'boom' }),
      }),
    );
  });
});
