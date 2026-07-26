/**
 * ResourceType — enum defining which entity kind a ResourceAggregate manages.
 *
 * @traceability DOC-012 Aggregate3 (ResourceType enum)
 */

export enum ResourceType {
  TRANSACTION = 'transaction',
  MEMBER = 'member',
  EVENT = 'event',
  ARCHIVE_ENTRY = 'archive_entry',
}
