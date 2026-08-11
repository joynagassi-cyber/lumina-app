/**
 * Event Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 4 (EventAggregate)
 * @traceability ASS-001: Application Services for event CRUD operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: event_record table
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CreateEventInput,
  EventCalendarData,
  EventRecord,
  ListEventsInput,
  PaginatedResponse,
  UpdateEventInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchEvents<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Event API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const eventApi = createApi({
  reducerPath: 'eventApi',
  baseQuery: async ({
    endpoint,
    method,
    body,
  }: {
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  }) => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: method ?? 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `API ${response.status}: ${errorBody || response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['Event', 'Attendance'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listEvents: builder.query<PaginatedResponse<EventRecord>, ListEventsInput>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.state) params.append('state', args.state);
        if (args.type) params.append('type', args.type);
        if (args.dateFrom) params.append('dateFrom', args.dateFrom);
        if (args.dateTo) params.append('dateTo', args.dateTo);
        if (args.search) params.append('search', args.search);
        if (args.page) params.append('page', args.page.toString());
        if (args.limit) params.append('limit', args.limit.toString());
        return {
          endpoint: `/events/${args.organizationId}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (_result, _err, arg) => [{ type: 'Event', id: arg.organizationId }],
    }),

    getEvent: builder.query<EventRecord, string>({
      query: (eventId) => ({ endpoint: `/events/${eventId}`, method: 'GET' }),
      providesTags: (_result, _err, eventId) => [{ type: 'Event', id: eventId }],
    }),

    listEventCalendar: builder.query<EventCalendarData, string>({
      query: (month) => ({ endpoint: `/calendar/${month}`, method: 'GET' }),
      providesTags: [{ type: 'Event', id: 'CALENDAR' }],
    }),

    /* ---- Mutations ---- */

    createEvent: builder.mutation<EventRecord, CreateEventInput>({
      query: (body) => ({ endpoint: '/events', method: 'POST', body }),
      invalidatesTags: [{ type: 'Event', id: 'LIST' }],
    }),

    updateEvent: builder.mutation<EventRecord, UpdateEventInput>({
      query: ({ eventId, ...body }) => ({
        endpoint: `/events/${eventId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Event', id: arg.eventId }],
    }),

    cancelEvent: builder.mutation<EventRecord, string>({
      query: (eventId) => ({
        endpoint: `/events/${eventId}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, eventId) => [{ type: 'Event', id: eventId }],
    }),

    duplicateEvent: builder.mutation<EventRecord, string>({
      query: (eventId) => ({
        endpoint: `/events/${eventId}/duplicate`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Event', id: 'LIST' }],
    }),

    /* ---- Attendance Actions ---- */

    checkInAttendee: builder.mutation<{ eventId: string; memberId: string }, { eventId: string; memberId: string }>({
      query: ({ eventId, memberId }) => ({
        endpoint: `/events/${eventId}/checkin`,
        method: 'POST',
        body: { memberId },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Attendance', id: arg.eventId }],
    }),

    checkOutAttendee: builder.mutation<{ eventId: string; memberId: string }, { eventId: string; memberId: string }>({
      query: ({ eventId, memberId }) => ({
        endpoint: `/events/${eventId}/checkout`,
        method: 'POST',
        body: { memberId },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Attendance', id: arg.eventId }],
    }),

    listAttendees: builder.query<PaginatedResponse<{ readonly memberId: string; readonly name: string; readonly checkInAt: string }>, string>({
      query: (eventId) => ({ endpoint: `/events/${eventId}/attendees`, method: 'GET' }),
      providesTags: (_result, _err, eventId) => [{ type: 'Attendance', id: eventId }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListEventsQuery,
  useGetEventQuery,
  useListEventCalendarQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useCancelEventMutation,
  useDuplicateEventMutation,
  useCheckInAttendeeMutation,
  useCheckOutAttendeeMutation,
  useListAttendeesQuery,
} = eventApi;

export default eventApi;