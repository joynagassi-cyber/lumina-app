/**
 * Sync service skeleton — WatermelonDB sync per RTS-v1.
 */

export class SyncService {
  /**
   * Push pending local changes to the server.
   */
  async pushChanges(_db: unknown): Promise<void> {
    // TODO: Iterate pending_operations and apply remote mutations
  }

  /**
   * Pull remote changes since last sync timestamp.
   */
  async pullChanges(_db: unknown, _since: Date): Promise<void> {
    // TODO: Fetch changeset via WebSub or SSE
  }
}
