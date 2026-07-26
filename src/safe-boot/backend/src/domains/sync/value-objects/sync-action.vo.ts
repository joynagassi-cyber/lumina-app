/**
 * SyncAction — enum defining the type of sync operation for pending changes.
 *
 * @traceability DOC-012 Aggregate13 (SyncAction enum)
 * @invariant Must be one of: create, update, delete
 */

export enum SyncAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}
