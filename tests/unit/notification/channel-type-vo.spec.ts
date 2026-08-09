/**
 * ChannelType Value Object Tests
 *
 * Tests notification channel types and delivery behavior.
 * @traceability DOC-012 VO-ChannelType, BR-NOT-003, BR-NOT-004
 */

import { ChannelType, OPTIONAL_CHANNELS, isAlwaysDelivered } from '@/domains/notification/domain/value-objects/channel-type.vo';

describe('ChannelType', () => {
  it('should define all valid channel types', () => {
    expect(Object.values(ChannelType)).toEqual([
      'in_app',
      'push',
      'email',
      'sms',
    ]);
  });

  it('should identify optional channels', () => {
    expect(OPTIONAL_CHANNELS.has(ChannelType.PUSH)).toBe(true);
    expect(OPTIONAL_CHANNELS.has(ChannelType.EMAIL)).toBe(true);
    expect(OPTIONAL_CHANNELS.has(ChannelType.SMS)).toBe(true);
    expect(OPTIONAL_CHANNELS.has(ChannelType.IN_APP)).toBe(false);
  });

  it('should identify in-app as always delivered', () => {
    expect(isAlwaysDelivered(ChannelType.IN_APP)).toBe(true);
    expect(isAlwaysDelivered(ChannelType.PUSH)).toBe(false);
    expect(isAlwaysDelivered(ChannelType.EMAIL)).toBe(false);
    expect(isAlwaysDelivered(ChannelType.SMS)).toBe(false);
  });
});
