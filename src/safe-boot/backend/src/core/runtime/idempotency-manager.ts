/**
 * IdempotencyManager — CRT-013 (ADR-018).
 *
 * Détection des opérations dupliquées via une clé idempotente org-scoped
 * (INV-004) : `org_id:clé`. Résultat mis en cache et retourné tel quel pour
 * une clé déjà traitée. TTL 24 h (INV-004).
 *
 * Cache in-memory au MVP (Map + horodatage) — aucun binding Redis à ce stade ;
 * l'interface est volontairement étroite pour permettre un swap vers
 * @nestjs/cache-manager (CachePort, PAS-001) sans impact sur les appelants.
 *
 * Écart documenté vs ADR-018 : le scope REQUEST mentionné pour CRT-013 rendrait
 * le cache inutile (perdu à la fin de chaque requête) ; on retient un provider
 * singleton avec TTL — l'idempotence est un état partagé, pas un état de requête.
 *
 * @traceability ADR-018 §3.1 (CRT-013), INV-004 (clé org-scoped, TTL 24 h)
 */

import { Injectable } from '@nestjs/common';

interface IdempotencyEntry<T = unknown> {
  expiresAt: number;
  result: T;
}

@Injectable()
export class IdempotencyManager {
  private readonly store = new Map<string, IdempotencyEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  private key(orgId: string, idempotencyKey: string): string {
    return `${orgId}:${idempotencyKey}`;
  }

  /**
   * Exécute l'opération si la clé est nouvelle (ou expirée), sinon retourne
   * le résultat mis en cache (invariant : la requête est un doublon).
   */
  async execute<T>(
    orgId: string,
    idempotencyKey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const storeKey = this.key(orgId, idempotencyKey);
    const cached = this.store.get(storeKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result as T;
    }
    const result = await operation();
    this.store.set(storeKey, { expiresAt: Date.now() + this.ttlMs, result });
    return result;
  }

  /** true si une entrée non expirée existe pour cette clé org-scoped. */
  isDuplicate(orgId: string, idempotencyKey: string): boolean {
    const storeKey = this.key(orgId, idempotencyKey);
    const cached = this.store.get(storeKey);
    if (!cached) {
      return false;
    }
    if (cached.expiresAt <= Date.now()) {
      this.store.delete(storeKey);
      return false;
    }
    return true;
  }

  /** Purge les entrées expirées (appelé périodiquement / au health check). */
  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /** Vide le cache (tests, reset). */
  clear(): void {
    this.store.clear();
  }
}
