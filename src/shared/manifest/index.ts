/**
 * Manifest Engine — barrel export.
 *
 * Usage:
 *   import { ManifestEngine, ManifestValidationError } from '@/shared/manifest';
 *   import mfeJcManifest from '@/shared/manifest/manifests/mfe-jc.json';
 */
export { ManifestEngine, ManifestValidationError } from './manifest-engine';
export type {
  OrgManifest,
  OrgBranding,
  OrgConfiguration,
  VocabularyNamespace,
  VocabularyTerm,
  FeatureEntry,
  RoleDefinition,
  FormDefinitionRef,
  FormFieldDef,
  WorkflowDefinition,
  WorkflowNodeDef,
} from './types';
