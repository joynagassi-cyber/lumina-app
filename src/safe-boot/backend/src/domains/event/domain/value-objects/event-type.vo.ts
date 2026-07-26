/**
 * EventType — immutable value object representing the type of an event.
 * All valid event types are declared here as enum members for compile-time safety.
 *
 * @traceability DOC-012 Aggregate3 (EventRecord.eventType), PG-Schema-v1 events.type_evenement
 * @invariant values must match the database CHECK constraint range
 */

export enum EventType {
  WORSHIP = 'worship',
  PRAYER_MEETING = 'prayer_meeting',
  BAPTISM = 'baptism',
  CONFIRMATION = 'confirmation',
  CONCERT = 'concert',
  TRAINING = 'training',
  MEETING = 'meeting',
  OUTREACH = 'outreach',
  CELEBRATION = 'celebration',
  SEMINAR = 'seminar',
  CUSTOM = 'custom',
}
