/**
 * Ports non câblés au MVP Jour 1 (MVP-JOUR1-SPEC §2 — périmètre : transactions).
 *
 * Ces adapters sont EXPLICITES : le port existe dans le domaine (ResourceAggregate
 * complet), mais l'infrastructure concrète sera branchée dans une phase ultérieure.
 * Toute utilisation lève une erreur claire — aucune implémentation silencieuse.
 *
 * @traceability DOC-012 Aggregate3 (ports), MVP-JOUR1-SPEC §2 (périmètre J1)
 */

export class NotWiredInMvpError extends Error {
  constructor(portName: string) {
    super(`Port "${portName}" non câblé au MVP Jour 1 — phase ultérieure requise.`);
    this.name = 'NotWiredInMvpError';
  }
}

function notWired(port: string): never {
  throw new NotWiredInMvpError(port);
}

export class MemberPortNotWired {
  findById(): Promise<never> { return Promise.resolve(notWired('IMemberPort')); }
  findByOrg(): Promise<never> { return Promise.resolve(notWired('IMemberPort')); }
  create(): Promise<never> { return Promise.resolve(notWired('IMemberPort')); }
  update(): Promise<never> { return Promise.resolve(notWired('IMemberPort')); }
  changeState(): Promise<never> { return Promise.resolve(notWired('IMemberPort')); }
  delete(): Promise<never> { return Promise.resolve(notWired('IMemberPort')); }
}

export class EventPortNotWired {
  findById(): Promise<never> { return Promise.resolve(notWired('IEventPort')); }
  findByOrg(): Promise<never> { return Promise.resolve(notWired('IEventPort')); }
  create(): Promise<never> { return Promise.resolve(notWired('IEventPort')); }
  update(): Promise<never> { return Promise.resolve(notWired('IEventPort')); }
  transitionState(): Promise<never> { return Promise.resolve(notWired('IEventPort')); }
  delete(): Promise<never> { return Promise.resolve(notWired('IEventPort')); }
}

export class ArchiveEntryPortNotWired {
  findById(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
  findByOrg(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
  create(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
  transitionState(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
  applyTags(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
  removeTags(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
  delete(): Promise<never> { return Promise.resolve(notWired('IArchiveEntryPort')); }
}

export class NotificationPortNotWired {
  findById(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
  findByRecipient(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
  create(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
  markSent(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
  markFailed(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
  markRead(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
  markRetry(): Promise<never> { return Promise.resolve(notWired('INotificationPort')); }
}
