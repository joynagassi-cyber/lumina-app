/**
 * Vocabulary Domain Services — barrel export.
 */

export {
  TermResolver,
  type TermLookupResult,
  type ValueLookupResult,
  TermNotFoundError,
} from './term-resolver.service';

export {
  NamespaceBrowser,
  type BrowserTermDto,
  type BrowserValueDto,
  type NamespaceSummary,
} from './namespace-browser.service';

export {
  DeprecationManager,
  AlreadyDeprecatedError as DeprecationManagerAlreadyDeprecatedError,
  type DeprecationResult,
} from './deprecation-manager.service';
