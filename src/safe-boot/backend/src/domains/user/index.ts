/**
 * User Domain — IdentityAggregate implementation
 *
 * Aggregate 2 from DOC-012 (Canonical Domain Model)
 * Tables: users, sessions, credentials (PG-Schema-v1 Tables 4-6)
 * Application Service: IdentityService (ASS-001 Service 2)
 * Business Rules: BR-ID-001 through BR-ID-006
 *
 * @traceability DOC-012 §Aggregate2 → PAS-v1 → IGS-v1 Step5
 */

export * from './ports';
export * from './domain';
export * from './application';
export * from './infrastructure';
export { UserModule } from './user.module';
