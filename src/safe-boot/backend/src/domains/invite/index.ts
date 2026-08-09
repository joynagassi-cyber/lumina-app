/**
 * Invite Domain — Invitation Management Aggregate
 *
 * Implements BR-INV-001 through BR-INV-005 per ORG-008 specification.
 * Aggregate Root: Invite
 * Pattern: Ports & Adapter (PAS-v1) + CQRS event-driven
 *
 * @traceability ORG-008 Invitation Module → INV-Architecture v1
 */

export * from './ports';
export * from './domain';
export * from './application';
export * from './infrastructure';
export { InviteModule } from './invite.module';