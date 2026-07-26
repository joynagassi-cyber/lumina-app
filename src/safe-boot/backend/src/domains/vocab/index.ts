/**
 * VocabularyAggregate — Barrel Export
 *
 * Full aggregate implementation per DOC-012 Aggregate8.
 * Exposes domain services, application service, module, and type contracts.
 *
 * @traceability DOC-012 Aggregate8 → Capability: Vocabulary (DOC-006)
 *   → POSTGRESQL-SCHEMA-PACK-v1 Tables 22-24 (vocab_namespaces, vocab_terms, vocab_values)
 */

// ---- Module ----
export { VocabModule } from './vocab.module';

// ---- Application Service ----
export { VocabApplicationService } from './application/vocab.service';

// ---- Domain Events ----
export {
  TermAdded,
  TermValueAdded,
  TermDepreciated,
  TermValueDeprecated,
  LabelUpdated,
  TranslationResolved,
} from './domain/events';

// ---- Domain Entities ----
export {
  Namespace,
  Term,
  TermValue,
} from './domain/entities';

export type {
  NamespaceProps,
  TermProps,
  TermValueProps,
} from './domain/entities';

// ---- Domain Value Objects ----
export {
  NamespaceKey,
  InvalidNamespaceKeyError,
  TermKey,
  InvalidTermKeyError,
  LabelPair,
  MissingTranslationError,
  DeprecatedFlag,
  DeprecatedAlreadyError,
  ColorHex,
  InvalidColorHexError,
} from './domain/value-objects';

// ---- Domain Services ----
export {
  TermResolver,
  TermNotFoundError,
  type TermLookupResult,
  type ValueLookupResult,
} from './domain/services';

export {
  NamespaceBrowser,
  type BrowserTermDto,
  type BrowserValueDto,
  type NamespaceSummary,
} from './domain/services';

export {
  DeprecationManager,
} from './domain/services';

// ---- Policies ----
export {
  NeverDeletePolicy,
  DeleteForbiddenError,
  TranslationMinimumPolicy,
  MissingRequiredTranslationError,
  StabilityPolicy,
  KeyChangeForbiddenError,
} from './domain/policies';

// ---- Ports ----
export type {
  CreateNamespaceInput,
  CreateTermInput,
  CreateTermValueInput,
  UpdateTermLabelInput,
  UpdateTermValueLabelInput,
  INamespaceRepository,
  ITermRepository,
  ITermValueRepository,
} from './ports/vocab.port';
