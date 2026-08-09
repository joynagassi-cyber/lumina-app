/**
 * EventService Unit Tests — Positive Cases
 *
 * Tests event operations: create, findById, update, publish, cancel, complete, delete, search.
 * @traceability DOC-012 ASS-001 EventService, Event Aggregate Commands
 */

import { EventService, EventNotFoundError, EventValidationError } from '@/domains/event/application/event.service';
import { IEventRepository } from '@/domains/event/ports/event-port.interface';
import { DomainEventPublisher } from '@/domains/event/application/event-publisher.interface';
import { EventState } from '@/domains/event/domain/value-objects/event-state.vo';
import { EventRecord } from '@/domains/event/domain/entities/event-record.entity';
import { ResourceId } from '@/domains/finance/value-objects/resource-id.vo';
import { ResourceMetadata } from '@/domains/finance/value-objects/resource-metadata.vo';

// Valid UUIDs (ResourceId enforces RFC-style uuid format)
const UUID_1 = '00000000-0000-4000-8000-000000000001';
const UUID_2 = '00000000-0000-4000-8000-000000000002';
const UUID_3 = '00000000-0000-4000-8000-000000000003';

// Mock implementations
class MockEventRepo implements IEventRepository {
  create = jest.fn();
  findById = jest.fn();
  findByOrg = jest.fn();
  findByOrgAndState = jest.fn();
  search = jest.fn();
  update = jest.fn();
  transitionState = jest.fn();
  delete = jest.fn();
}

class MockEventPublisher {
  publish = jest.fn();
}

describe('EventService', () => {
  let service: EventService;
  let eventRepoMock: MockEventRepo;
  let eventPubMock: MockEventPublisher;

  beforeEach(() => {
    eventRepoMock = new MockEventRepo();
    eventPubMock = new MockEventPublisher();

    service = new EventService(eventRepoMock as any, eventPubMock as any);
  });

  /** Helper: build a valid EventRecord (past dates, draft state, version 1). */
  function makeEvent(overrides: Partial<{ id: ResourceId; title: string; state: EventState }> = {}): EventRecord {
    return EventRecord.create({
      id: overrides.id ?? new ResourceId(UUID_1),
      orgId: 'org-1',
      createdBy: 'user-1',
      title: overrides.title ?? 'Test Event',
      eventType: 'meeting',
      startAt: new Date(Date.now() - 7200000),
      endAt: new Date(Date.now() - 3600000),
      location: null,
      responsibleUserId: 'user-1',
      description: null,
      state: overrides.state ?? EventState.DRAFT,
      metadata: new ResourceMetadata({}),
    });
  }

  describe('create', () => {
    it('should create event and publish EventCreated event (positive)', async () => {
      // Arrange
      const fakeEvent = makeEvent();
      eventRepoMock.create.mockResolvedValue(fakeEvent);

      // Act
      const result = await service.create({
        orgId: 'org-1',
        title: 'Test Event',
        eventType: 'meeting',
        startAt: new Date(Date.now() - 7200000),
        endAt: new Date(Date.now() - 3600000),
        location: 'Location 1',
        responsibleUserId: 'user-1',
        description: 'Test',
        metadata: {},
        createdBy: 'user-1',
      });

      // Assert
      expect(result).toBeTruthy();
      expect(eventRepoMock.create).toHaveBeenCalledWith(expect.any(EventRecord));
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'EventCreated' }),
      );
    });

    it('should reject future dates at creation (BR-RES-004)', async () => {
      await expect(
        service.create({
          orgId: 'org-1',
          title: 'Test Event',
          eventType: 'meeting',
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          createdBy: 'user-1',
        }),
      ).rejects.toThrow(EventValidationError);
      expect(eventRepoMock.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find event by id (positive)', async () => {
      // Arrange
      const event = makeEvent({ title: 'Test' });
      eventRepoMock.findById.mockResolvedValue(event);

      // Act
      const result = await service.findById(UUID_1);

      // Assert
      expect(result).toBeTruthy();
      expect(result?.title).toBe('Test');
      expect(eventRepoMock.findById).toHaveBeenCalledWith(new ResourceId(UUID_1));
    });

    it('should return null when event not found', async () => {
      // Arrange
      eventRepoMock.findById.mockResolvedValue(null);

      // Act
      const result = await service.findById(UUID_2);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update event fields successfully (positive)', async () => {
      // Arrange
      const existing = makeEvent({ title: 'Old Title' });
      eventRepoMock.findById.mockResolvedValue(existing);
      eventRepoMock.update.mockResolvedValue(existing);

      // Act
      await service.update(UUID_1, { title: 'New Title' }, 1);

      // Assert
      expect(eventRepoMock.update).toHaveBeenCalledWith(
        new ResourceId(UUID_1),
        expect.objectContaining({ title: 'New Title' }),
        1,
      );
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'EventUpdated' }),
      );
    });

    it('should throw when event not found', async () => {
      // Arrange
      eventRepoMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(UUID_2, { title: 'Test' }, 1)).rejects.toThrow(EventNotFoundError);
    });

    it('should enforce optimistic-lock version on update', async () => {
      // Arrange - entity at version 1, caller expects version 5
      const existing = makeEvent();
      eventRepoMock.findById.mockResolvedValue(existing);

      // Act & Assert
      await expect(service.update(UUID_1, { title: 'Test' }, 5)).rejects.toThrow(/version/i);
      expect(eventRepoMock.update).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish event from draft to published (positive)', async () => {
      // Arrange
      const updated = makeEvent({ state: EventState.PUBLISHED });
      eventRepoMock.transitionState.mockResolvedValue(updated);

      // Act
      await service.publish(UUID_1);

      // Assert
      expect(eventRepoMock.transitionState).toHaveBeenCalledWith(new ResourceId(UUID_1), EventState.DRAFT, EventState.PUBLISHED);
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'EventStateChanged' }),
      );
    });
  });

  describe('cancel', () => {
    it('should cancel draft event successfully (positive)', async () => {
      // Arrange
      const existing = makeEvent({ state: EventState.DRAFT });
      eventRepoMock.findById.mockResolvedValue(existing);
      const updated = makeEvent({ state: EventState.CANCELLED });
      eventRepoMock.transitionState.mockResolvedValue(updated);

      // Act
      await service.cancel(UUID_1);

      // Assert
      expect(eventRepoMock.transitionState).toHaveBeenCalledWith(new ResourceId(UUID_1), EventState.DRAFT, EventState.CANCELLED);
    });

    it('should cancel published event successfully (positive)', async () => {
      // Arrange
      const existing = makeEvent({ state: EventState.PUBLISHED });
      eventRepoMock.findById.mockResolvedValue(existing);
      const updated = makeEvent({ state: EventState.CANCELLED });
      eventRepoMock.transitionState.mockResolvedValue(updated);

      // Act
      await service.cancel(UUID_1);

      // Assert
      expect(eventRepoMock.transitionState).toHaveBeenCalledWith(new ResourceId(UUID_1), EventState.PUBLISHED, EventState.CANCELLED);
    });

    it('should throw when cancelling event in invalid state', async () => {
      // Arrange
      const existing = makeEvent({ state: EventState.COMPLETED });
      eventRepoMock.findById.mockResolvedValue(existing);

      // Act & Assert
      await expect(service.cancel(UUID_1)).rejects.toThrow(EventValidationError);
      await expect(service.cancel(UUID_1)).rejects.toThrow('Cannot cancel event in state completed');
    });
  });

  describe('complete', () => {
    it('should complete published event (positive)', async () => {
      // Arrange
      const updated = makeEvent({ state: EventState.COMPLETED });
      eventRepoMock.transitionState.mockResolvedValue(updated);

      // Act
      await service.complete(UUID_1);

      // Assert
      expect(eventRepoMock.transitionState).toHaveBeenCalledWith(new ResourceId(UUID_1), EventState.PUBLISHED, EventState.COMPLETED);
    });
  });

  describe('delete', () => {
    it('should delete event successfully (positive)', async () => {
      // Arrange
      const existing = makeEvent();
      eventRepoMock.findById.mockResolvedValue(existing);
      eventRepoMock.delete.mockResolvedValue(true);

      // Act
      const result = await service.delete(UUID_1);

      // Assert
      expect(result).toBe(true);
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'EventDeleted' }),
      );
    });

    it('should throw when event not found', async () => {
      // Arrange
      eventRepoMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(UUID_2)).rejects.toThrow(EventNotFoundError);
    });
  });

  describe('search', () => {
    it('should search events by orgId (positive)', async () => {
      // Arrange
      const events = [makeEvent()];
      eventRepoMock.findByOrg.mockResolvedValue({ data: events, count: 1, page: 1, limit: 20 });

      // Act
      const result = await service.search({ orgId: 'org-1' });

      // Assert
      expect(result).toBeTruthy();
      expect(eventRepoMock.findByOrg).toHaveBeenCalledWith('org-1', 1, 20);
    });

    it('should search events by orgId and state (positive)', async () => {
      // Arrange
      eventRepoMock.findByOrgAndState.mockResolvedValue({ data: [], count: 0, page: 1, limit: 20 });

      // Act
      await service.search({ orgId: 'org-1', state: EventState.DRAFT });

      // Assert
      expect(eventRepoMock.findByOrgAndState).toHaveBeenCalledWith('org-1', EventState.DRAFT, 1, 20);
    });
  });
});
