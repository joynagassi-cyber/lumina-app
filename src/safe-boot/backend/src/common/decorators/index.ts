// Common decorators — skeleton per ITS-V1

export interface Metadata {
  key: string;
  value: unknown;
}

/**
 * Placeholder decorator factory.
 * Domain-specific decorators will extend this pattern.
 */
export function DecoratorName(
  _metadata: Record<string, unknown>,
): PropertyDecorator & MethodDecorator {
  return (_target, _propertyKey, descriptor?) => {
    // TODO: Implement domain-specific decorator logic
  };
}
