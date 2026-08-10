/**
 * Event Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 4 (EventAggregate)
 * @traceability DOC-006: Event concept
 * @traceability DOC-021: Physical Data Model event_record table
 * @traceability ASS-001: Application Services for event operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Event type enum per BR-EVT-001 classification.
 */
export type EventType = 'church' | 'school' | 'community' | 'personal' | 'other';

/**
 * Event state/lifecycle per BR-EVT transitions.
 */
export type EventState = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

/**
 * Event scope (who can attend).
 */
export type EventScope = 'public' | 'private' | 'restricted';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * EventAggregate root entity.
 * Maps to physical table `event_record` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface EventRecord {
  /** Universally unique identifier for this event. */
  readonly id: string;

  /** Organization this event belongs to. */
  readonly organizationId: string;

  /** Event title. */
  readonly title: string;

  /** Event description. */
  readonly description: string;

  /** Event type. */
  readonly type: EventType;

  /** Start datetime (UTC ISO 8601). */
  readonly startDateTime: string;

  /** End datetime (UTC ISO 8601). */
  readonly endDateTime: string;

  /** Location (physical or virtual). */
  readonly location: string | null;

  /** Event capacity (null for unlimited). */
  readonly capacity: number | null;

  /** Current registration count. */
  readonly registeredCount: number;

  /** Event state/lifecycle stage. */
  readonly state: EventState;

  /** Scope (public/private/restricted). */
  readonly scope: EventScope;

  /** Organizer user ID. */
  readonly organizerId: string | null;

  /** Whether this event is recurring. */
  readonly isRecurring: boolean;

  /** Recurrence pattern (if applicable). */
  readonly recurrenceRule: string | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * Event attendance record.
 */
export interface EventAttendance {
  /** Unique identifier for this attendance record. */
  readonly id: string;

  /** Event ID. */
  readonly eventId: string;

  /** Member/user ID who attended. */
  readonly memberId: string;

  /** Check-in timestamp. */
  readonly checkInAt: string;

  /** Check-out timestamp (null if still attending). */
  readonly checkOutAt: string | null;

  /** Attendance status. */
  readonly status: 'checked_in' | 'checked_out' | 'pending';
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateEvent command.
 */
export interface CreateEventInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** Event title (required). */
  readonly title: string;

  /** Event description. */
  readonly description?: string;

  /** Event type (required). */
  readonly type: EventType;

  /** Start datetime (required). */
  readonly startDateTime: string;

  /** End datetime (required). */
  readonly endDateTime: string;

  /** Location (optional). */
  readonly location?: string;

  /** Event capacity (optional, null for unlimited). */
  readonly capacity?: number | null;

  /** Event state (default: 'draft'). */
  readonly state?: EventState;

  /** Scope (default: 'private'). */
  readonly scope?: EventScope;

  /** Organizer ID (optional, defaults to current user). */
  readonly organizerId?: string | null;

  /** Whether the event is recurring (default: false). */
  readonly isRecurring?: boolean;

  /** Recurrence rule (optional, iCalendar format). */
  readonly recurrenceRule?: string | null;
}

/**
 * Input for UpdateEvent command.
 */
export interface UpdateEventInput {
  /** Event ID to update. */
  readonly eventId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Event title (optional update). */
  readonly title?: string;

  /** Event description (optional update). */
  readonly description?: string;

  /** Event type (optional update). */
  readonly type?: EventType;

  /** Start datetime (optional update). */
  readonly startDateTime?: string;

  /** End datetime (optional update). */
  readonly endDateTime?: string;

  /** Location (optional update). */
  readonly location?: string;

  /** Capacity (optional update). */
  readonly capacity?: number | null;

  /** State transition (triggers lifecycle validation). */
  readonly state?: EventState;

  /** Scope (optional update). */
  readonly scope?: EventScope;

  /** Organizer ID (optional update). */
  readonly organizerId?: string | null;

  /** Is recurring (optional update). */
  readonly isRecurring?: boolean;

  /** Recurrence rule (optional update). */
  readonly recurrenceRule?: string | null;
}

/**
 * Input for ListEvents query.
 */
export interface ListEventsInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Filter by state (optional). */
  readonly state?: EventState;

  /** Filter by type (optional). */
  readonly type?: EventType;

  /** Date range start (optional, ISO 8601). */
  readonly dateFrom?: string;

  /** Date range end (optional, ISO 8601). */
  readonly dateTo?: string;

  /** Search query (by title, description). */
  readonly search?: string;

  /** Pagination: page number (default: 1). */
  readonly page?: number;

  /** Pagination: items per page (default: 20, max: 100). */
  readonly limit?: number;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}

/**
 * Event calendar view data (month view).
 */
export interface EventCalendarData {
  /** Month label (e.g., "2026-01"). */
  readonly month: string;

  /** Events grouped by day. */
  readonly days: ReadonlyArray<{
    readonly date: string; // ISO date (YYYY-MM-DD)
    readonly events: ReadonlyArray<EventRecord>;
  }>;

  /** Total events in this month. */
  readonly totalEvents: number;
}

/**
 * Aggregated structure returned by useEvents().
 */
export interface EventDomainModel {
  /** List of events. */
  readonly events: ReadonlyArray<EventRecord>;

  /** Total count matching filters. */
  readonly totalCount: number;

  /** Currently selected event (if any). */
  readonly selectedEvent: EventRecord | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the Event WatermelonDB model.
 */
export interface EventAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  title: string;
  description: string | null;
  type: EventType;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  capacity: number | null;
  state: EventState;
  scope: EventScope;
  organizerId: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}