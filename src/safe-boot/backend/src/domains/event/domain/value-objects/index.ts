/**
 * Event Domain Value Objects — barrel export.
 *
 * @traceability DOC-012 Aggregate3 (Value Objects catalog)
 */

export { EventType, type EventType as IEventType } from './event-type.vo';
export {
  EventState,
  EVENT_STATE_TRANSITIONS,
  canTransitionFrom as eventCanTransitionFrom,
} from './event-state.vo';
export { EventScope, EventScopeType } from './event-scope.vo';
export { EventDates, type InvalidEventDateError } from './event-dates.vo';
