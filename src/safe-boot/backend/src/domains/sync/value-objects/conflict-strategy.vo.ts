/**
 * ConflictStrategy — enum defining how to resolve sync conflicts per entity type.
 *
 * @traceability DOC-012 Aggregate13 (ConflictStrategy enum)
 * @invariant Must be one of: LWW, server_wins, immutable, uuid_dedup, side_by_side
 */

export enum ConflictStrategy {
  LAST_WRITE_WINS = 'LWW',
  SERVER_WINS = 'server_wins',
  IMMUTABLE = 'immutable',
  UUID_DEDUP = 'uuid_dedup',
  SIDE_BY_SIDE = 'side_by_side',
}
