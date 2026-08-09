/**
 * EventEmitter2DomainEventPublisher — specs CRT-004 (ADR-018).
 */

import { EventEmitter2DomainEventPublisher } from '../../../src/safe-boot/backend/src/core/runtime/event-emitter-publisher';
import { DomainEvent } from '../../../src/safe-boot/backend/src/shared/events';

function makeEmitter() {
  return {
    on: jest.fn(),
    emitAsync: jest.fn(async () => []),
  };
}

function makeEvent(eventType: string): DomainEvent {
  return new (class extends DomainEvent {})(eventType);
}

describe('EventEmitter2DomainEventPublisher (CRT-004)', () => {
  it('register abonne un handler au type d’événement', () => {
    const emitter = makeEmitter();
    const publisher = new EventEmitter2DomainEventPublisher(emitter as never);
    const handler = jest.fn();

    publisher.register('tx.created', handler);

    expect(emitter.on).toHaveBeenCalledWith('tx.created', expect.any(Function));
  });

  it('publish délègue à emitAsync (publication après persistance)', async () => {
    const emitter = makeEmitter();
    const publisher = new EventEmitter2DomainEventPublisher(emitter as never);
    const event = makeEvent('tx.created');

    await publisher.publish(event);

    expect(emitter.emitAsync).toHaveBeenCalledWith('tx.created', event);
  });

  it('publishAll publie chaque événement dans l’ordre', async () => {
    const emitter = makeEmitter();
    const publisher = new EventEmitter2DomainEventPublisher(emitter as never);
    const first = makeEvent('a');
    const second = makeEvent('b');

    await publisher.publishAll([first, second]);

    expect(emitter.emitAsync).toHaveBeenCalledTimes(2);
    expect(emitter.emitAsync).toHaveBeenNthCalledWith(1, 'a', first);
    expect(emitter.emitAsync).toHaveBeenNthCalledWith(2, 'b', second);
  });
});
