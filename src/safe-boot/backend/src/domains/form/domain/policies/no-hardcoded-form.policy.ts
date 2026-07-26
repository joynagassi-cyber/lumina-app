/**
 * NoHardcodedFormPolicy
 *
 * Enforces INV-009: no form is ever rendered in JSX. All forms must be
 * configuration-driven through the FormRenderer service.
 *
 * @traceability DOC-012 Aggregate6 §Policies-NoHardcodedFormPolicy
 *   → INV-009 (No hardcoded forms)
 *   → BR-FRM-003 (visible_if conditions processed by FormRenderer, not by conditional JSX)
 */

export class HardcodedFormViolationError extends Error {
  constructor(context: string) {
    super(
      `INV-009 violation: A form component is hardcoded in ${context}. ` +
        'All forms MUST be rendered via FormRenderer from JSON/YAML configuration.',
    );
    this.name = 'HardcodedFormViolationError';
  }
}

export class NoHardcodedFormPolicy {
  /**
   * Scan a source code file for hardcoded form elements.
   * Returns true if a violation is detected.
   *
   * In practice, this is called by CI/CD linting or pre-commit hooks
   * to enforce INV-009 across the codebase.
   */
  static detectHardcodedForm(sourceText: string): boolean {
    // Detect JSX form elements with hardcoded fields
    const jsxFieldPatterns = [
      /<(TextInput|View|Text)\s+[^>]*name=["']\w+["']/i,  // RN components with hardcoded name prop
      /<FormInput.*label=["'][^"']*["'].*\/>/i,             // Custom FormInput with hardcoded label
      /<Screen\s+[^>]*form=\{[^}]+\}>/i,                    // Inline form objects in JSX
    ];

    for (const pattern of jsxFieldPatterns) {
      if (pattern.test(sourceText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Assert that form rendering goes through the renderer, not JSX.
   * Call this at the boundary between application and infrastructure layers.
   */
  static assertRenderedViaService(componentName: string): void {
    // Valid renderers are registered at composition root
    const validRenderers = ['FormRenderer', 'DynamicFormRenderer'];
    if (!validRenderers.includes(componentName)) {
      throw new HardcodedFormViolationError(`component '${componentName}'`);
    }
  }

  /**
   * Verify a field definition uses vocabulary for select/multiselect types.
   * This is the domain-layer enforcement of BR-FRM-001.
   */
  static assertVocabularyReference(fieldType: string, sourceKey: string | null): void {
    if ((fieldType === 'select' || fieldType === 'multiselect') && !sourceKey) {
      throw new HardcodedFormViolationError(
        `select/multiselect field without vocabulary reference`,
      );
    }
  }
}
