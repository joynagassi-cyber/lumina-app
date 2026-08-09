/**
 * Delegation module — public API export.
 * Re-exports key types and interfaces for external consumption.
 */

export * from './domain/entities/grant-entry';
export * from './domain/value-objects/grant-id.vo';
export * from './domain/value-objects/grant-scope.vo';
export * from './domain/value-objects/grant-permission.vo';
export * from './domain/value-objects/grant-status.enum';
export * from './domain/events/grant-events';
export * from './domain/policies/delegation-errors';
export * from './domain/services/grant-validator';

// Ports — GrantEntryProps est re-exporté depuis l'entité (ambiguïté TS2308 évitée)
export type { IGrantRepository, IAuthorizationPort, IAuditLogger, IEventPublisherPort } from './ports/delegation.ports';

// Application
export * from './application/delegation-service';