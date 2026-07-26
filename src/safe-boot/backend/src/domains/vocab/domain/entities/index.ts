/**
 * Vocabulary Domain Entities — barrel export.
 */

export { Namespace } from './namespace.entity';
export type { NamespaceProps } from './namespace.entity';

export { Term, AlreadyDeprecatedError as TermAlreadyDeprecatedError } from './term.entity';
export type { TermProps } from './term.entity';

export {
  TermValue,
  AlreadyDeprecatedError as TermValueAlreadyDeprecatedError,
} from './term-value.entity';
export type { TermValueProps } from './term-value.entity';
