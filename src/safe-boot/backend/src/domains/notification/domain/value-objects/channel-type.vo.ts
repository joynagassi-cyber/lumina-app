/**
 * ChannelType — which delivery channel a notification uses.
 *
 * Immutable VO. Maps to PG-Schema Table 19 canal CHECK constraint:
 *   CHECK (canal IN ('in_app','push','email','sms'))
 *
 * BR-NOT-003: in-app always delivered (offline first).
 * BR-NOT-004: push/email/sms optional (fail gracefully).
 *
 * @traceability DOC-012 Aggregate7 VO ChannelType → PG-Schema-v1 Table 19 canal
 */

export enum ChannelType {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
}

/** Channels that require an external transport (optional per BR-NOT-004). */
export const OPTIONAL_CHANNELS: ReadonlySet<ChannelType> = new Set<ChannelType>([
  ChannelType.PUSH,
  ChannelType.EMAIL,
  ChannelType.SMS,
]);

/** In-app is always delivered regardless of network state. */
export function isAlwaysDelivered(channel: ChannelType): boolean {
  return channel === ChannelType.IN_APP;
}
