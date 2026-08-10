/**
 * Event Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 4 (EventAggregate)
 * @traceability ASS-001: Application Services for event operations
 */

import { useMemo } from 'react';
import type { EventRecord, EventCalendarData, EventState, EventType } from './types';
import {
  useListEventsQuery,
  useGetEventQuery,
  useListEventCalendarQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useEvents                                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns events list for an organization with filtering capabilities.
 */
export function useEvents(organizationId: string | null, options?: {
  state?: EventState;
  type?: EventType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { data: eventsResponse, isLoading: loadingEvents, error: eventsError } = useListEventsQuery(
    {
      organizationId: organizationId ?? '',
      ...(options ? {
        state: options.state,
        type: options.type,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        search: options.search,
        page: options.page,
        limit: options.limit,
      } : {}),
    },
    {
      skip: !organizationId,
    }
  );

  const events = eventsResponse?.items as EventRecord[] | [];
  const totalCount = eventsResponse?.totalCount || 0;

  return useMemo(() => ({
    events,
    totalCount,
    selectedEvent: null,
    isLoading: loadingEvents,
    error: eventsError,
    loading: loadingEvents,
  }), [events, totalCount, loadingEvents, eventsError]);
}

/* ------------------------------------------------------------------ */
/*  useEvent                                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific event by ID with full details.
 */
export function useEvent(organizationId: string | null, eventId: string | null) {
  const { data: event, isLoading: loadingEvent, error: eventError } = useGetEventQuery(
    eventId ?? '',
    {
      skip: !eventId || !organizationId,
    }
  );

  const eventRecord = event as EventRecord | undefined;

  return useMemo(() => ({
    event: eventRecord ?? null,
    isLoading: loadingEvent,
    error: eventError,
    loading: loadingEvent,
  }), [eventRecord, loadingEvent, eventError]);
}

/* ------------------------------------------------------------------ */
/*  useEventCalendar                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns calendar view data for an organization for a specific month.
 * Maps to BR-EVT calendar visualization requirements.
 */
export function useEventCalendar(organizationId: string | null, month: string | null) {
  const { data: calendarData, isLoading: loadingCalendar, error: calendarError } =
    useListEventCalendarQuery(month ?? '', { skip: !month || !organizationId });

  const calendar = calendarData as EventCalendarData | undefined;

  return useMemo(() => ({
    calendar: calendar ?? null,
    organizationId,
    month,
    isLoading: loadingCalendar,
    error: calendarError,
    loading: loadingCalendar,
  }), [calendar, loadingCalendar, calendarError, organizationId, month]);
}