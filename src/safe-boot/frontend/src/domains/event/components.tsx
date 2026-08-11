/**
 * Event Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 4 (EventAggregate)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import type { EventRecord, EventType, EventState, EventCalendarData } from './types';

/* ------------------------------------------------------------------ */
/*  EventList                                                          */
/* ------------------------------------------------------------------ */

export interface EventListProps {
  events: ReadonlyArray<EventRecord>;
  isLoading?: boolean;
  error?: string;
  onSelect?: (event: EventRecord) => void;
  onAdd?: () => void;
  filterState?: EventState;
  onFilterChange?: (state: EventState | undefined) => void;
  searchPlaceholder?: string;
}

export function EventList({
  events,
  isLoading = false,
  error,
  onSelect,
  onAdd,
  filterState,
  onFilterChange,
  searchPlaceholder = 'Search events...',
}: EventListProps): React.ReactElement | null {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = useMemo(() => {
    return events
      .filter((e) => {
        const matchesFilter = !filterState || e.state === filterState;
        const matchesSearch = !searchQuery ||
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.type.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }, [events, filterState, searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No events found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onAdd && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.searchInput}
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#888"
      />

      <FlatList
        data={filteredEvents}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.eventItem}
            onPress={() => onSelect?.(item)}
          >
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventMeta}>
                {item.type} • {new Date(item.startDateTime).toLocaleDateString()}
              </Text>
              <Text style={styles.eventMeta}>
                {item.registeredCount}/{item.capacity ?? '∞'} registered
              </Text>
            </View>
            <View style={styles.eventStatus}>
              <Text style={[styles.stateTag, styles[stateTagStyle(item.state)]]}>
                {item.state}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function stateTagStyle(state: EventState): keyof typeof styles {
  const styleMap: Record<EventState, keyof typeof styles> = {
    draft: 'draftTag',
    scheduled: 'scheduledTag',
    ongoing: 'ongoingTag',
    completed: 'completedTag',
    cancelled: 'cancelledTag',
  };
  return styleMap[state] || 'draftTag';
}

/* ------------------------------------------------------------------ */
/*  EventCalendar                                                      */
/* ------------------------------------------------------------------ */

export interface EventCalendarProps {
  calendarData: EventCalendarData | null;
  isLoading?: boolean;
  error?: string;
  onEventSelect?: (event: EventRecord) => void;
  onMonthChange?: (month: string) => void;
}

export function EventCalendar({
  calendarData,
  isLoading = false,
  error,
  onEventSelect,
  onMonthChange,
}: EventCalendarProps): React.ReactElement | null {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!calendarData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No events to display</Text>
      </View>
    );
  }

  return (
    <View style={styles.calendarContainer}>
      <Text style={styles.calendarTitle}>
        Events for {calendarData.month}
      </Text>

      <FlatList
        data={calendarData.days}
        keyExtractor={(d) => d.date}
        renderItem={({ item }) => (
          <View style={styles.calendarDay}>
            <Text style={styles.calendarDate}>{item.date}</Text>
            {item.events.length > 0 && (
              <View style={styles.eventList}>
                {item.events.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.calendarEvent}
                    onPress={() => onEventSelect?.(event)}
                  >
                    <View style={styles.eventMiniInfo}>
                      <Text style={styles.eventMiniTitle}>{event.title}</Text>
                      <Text style={styles.eventMiniTime}>
                        {new Date(event.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.eventMiniState}>{event.state}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  EventDetails                                                       */
/* ------------------------------------------------------------------ */

export interface EventDetailsProps {
  event: EventRecord | null;
  isLoading?: boolean;
  error?: string;
  onBack?: () => void;
  onEdit?: (event: EventRecord) => void;
  onDelete?: (event: EventRecord) => void;
}

export function EventDetails({
  event,
  isLoading = false,
  error,
  onBack,
  onEdit,
  onDelete,
}: EventDetailsProps): React.ReactElement | null {
  if (!event) {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.detailsContainer}>
      {onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.detailsTitle}>{event.title}</Text>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Type</Text>
        <Text style={styles.detailValue}>{event.type}</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Date & Time</Text>
        <Text style={styles.detailValue}>
          {new Date(event.startDateTime).toLocaleString()} — {new Date(event.endDateTime).toLocaleString()}
        </Text>
      </View>

      {event.location && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Location</Text>
          <Text style={styles.detailValue}>{event.location}</Text>
        </View>
      )}

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Capacity</Text>
        <Text style={styles.detailValue}>
          {event.registeredCount} / (event.capacity ?? 'Unlimited')
        </Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Status</Text>
        <Text style={[styles.detailValue, styles[stateTagStyle(event.state)]]}>{event.state}</Text>
      </View>

      {event.description && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Description</Text>
          <Text style={styles.detailValue}>{event.description}</Text>
        </View>
      )}

      {(onEdit || onDelete) && (
        <View style={styles.actionButtons}>
          {onEdit && (
            <TouchableOpacity style={styles.actionButton} onPress={() => onEdit?.(event)}>
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => Alert.alert('Confirm Delete', 'Are you sure you want to delete this event?', [
              { text: 'Cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(event) },
            ])}>
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  calendarContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  detailsContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: { color: '#ff6b6b', fontSize: 14 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: { color: '#888', fontSize: 16 },
  addButton: {
    backgroundColor: '#6366f1',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    alignSelf: 'flex-end',
  },
  addButtonText: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  searchInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    borderColor: '#333',
    borderWidth: 1,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
    borderRadius: 8,
  },
  eventInfo: { flex: 1 },
  eventTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  eventMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  eventStatus: { marginLeft: 16 },
  stateTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  draftTag: { backgroundColor: '#FF9800', color: '#000' },
  scheduledTag: { backgroundColor: '#2196F3', color: '#fff' },
  ongoingTag: { backgroundColor: '#4CAF50', color: '#fff' },
  completedTag: { backgroundColor: '#9C27B0', color: '#fff' },
  cancelledTag: { backgroundColor: '#F44336', color: '#fff' },
  calendarTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  calendarDay: { backgroundColor: '#1e1e1e', padding: 12, marginVertical: 8, borderRadius: 8 },
  calendarDate: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  eventList: { marginTop: 8 },
  calendarEvent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#2d2d2d',
    marginVertical: 4,
    borderRadius: 6,
  },
  eventMiniInfo: { flex: 1 },
  eventMiniTitle: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
  eventMiniTime: { color: '#888', fontSize: 11, marginTop: 2 },
  eventMiniState: { color: '#888', fontSize: 11 },
  detailSection: { marginBottom: 12 },
  detailLabel: { color: '#888', fontSize: 12, fontWeight: '500' },
  detailValue: { color: '#ffffff', fontSize: 14, marginTop: 4 },
  backButton: { marginBottom: 16 },
  backButtonText: { color: '#6366f1', fontSize: 16 },
  detailsTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionButton: { flex: 1, paddingVertical: 12, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' },
  deleteButton: { backgroundColor: '#E51332' },
  actionButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});