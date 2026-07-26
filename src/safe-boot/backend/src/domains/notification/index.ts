/**
 * Notification Domain — skeleton per ITS-V1
 */

export interface INotificationPort {
  findById(id: string): Promise<unknown>;
  listForUser(userId: string): Promise<unknown[]>;
  create(data: unknown): Promise<unknown>;
}

export class NotificationModule {}
