/**
 * Event Domain — Redux slice for local event state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 4 (EventAggregate)
 * @traceability DOC-021: Physical Data Model event_record entity
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { castDraft } from 'immer';
import type { EventRecord, EventCalendarData } from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface EventState {
  /** Events list for current organization. */
  events: ReadonlyArray<EventRecord>;

  /** Currently selected event. */
  selectedEvent: EventRecord | null;

  /** Calendar data by month key. */
  calendarData: Record<string, EventCalendarData>;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: EventState = {
  events: [],
  selectedEvent: null,
  calendarData: {},
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const eventSlice = createSlice({
  name: 'event',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.events = [];
      state.selectedEvent = null;
      state.calendarData = {};
      state.error = null;
    },

    setEvents(state, action: PayloadAction<ReadonlyArray<EventRecord>>) {
      state.events = [...action.payload];
    },

    appendEvent(state, action: PayloadAction<EventRecord>) {
      state.events = [...state.events, action.payload];
    },

    setSelectedEvent(state, action: PayloadAction<EventRecord | null>) {
      state.selectedEvent = action.payload;
    },

    clearSelectedEvent(state) {
      state.selectedEvent = null;
    },

    setCalendarData(state, action: PayloadAction<{ month: string; data: EventCalendarData }>) {
      state.calendarData[action.payload.month] = castDraft(action.payload.data);
    },

    setEventLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setEventError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearEventState(state) {
      state.events = [];
      state.selectedEvent = null;
      state.calendarData = {};
      state.organizationId = null;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.isLoading = true;
          state.error = null;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled'),
        (state) => {
          state.isLoading = false;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action: { payload?: { message?: string } }) => {
          state.isLoading = false;
          state.error = action.payload?.message ?? 'An event operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setEvents,
  appendEvent,
  setSelectedEvent,
  clearSelectedEvent,
  setCalendarData,
  setEventLoading,
  setEventError,
  clearEventState,
} = eventSlice.actions;

export default eventSlice.reducer;