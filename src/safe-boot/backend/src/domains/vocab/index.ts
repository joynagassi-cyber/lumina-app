/**
 * Vocab Domain — skeleton per ITS-V1
 */

export interface IVocabPort {
  findById(id: string): Promise<unknown>;
  lookup(namespace: string, key: string): Promise<unknown>;
  createNamespace(data: unknown): Promise<unknown>;
}

export class VocabModule {}
