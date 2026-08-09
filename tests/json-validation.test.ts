/**
 * Tests for the JSON validation pipeline.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { preprocessAIRawJSON } from '../src/shared/json-preprocess';
import { validateConfig } from '../src/shared/json-validation';
import manifestSchema from '../schemas/manifest.draft-07.json';

const ajv = new Ajv({ allErrors: true, verbose: true, strict: true });
addFormats(ajv);

describe('JSON Validation Pipeline', () => {

  // -----------------------------------------------------------------------
  // Preprocessing tests
  // -----------------------------------------------------------------------

  describe('preprocessAIRawJSON', () => {

    it('strips markdown code fences', () => {
      const input = '```json\n{"key":"value"}\n```';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('strips json fence without language hint', () => {
      const input = '```\n{"key":"value"}\n```';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('fixes trailing commas', () => {
      const input = '{"key":"value",}\n';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('fixes trailing commas in arrays', () => {
      const input = '{"items":[1,2,3,]}\n';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"items":[1,2,3]}');
    });

    it('converts single quotes to double quotes', () => {
      const input = "{'key':'value'}";
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('preserves single quotes inside double-quoted strings', () => {
      const input = `{"text": "It's a test"}`;
      const result = preprocessAIRawJSON(input);
      expect(result).toBe(`{"text": "It's a test"}`);
    });

    it('removes inline comments', () => {
      const input = '{"key":"val"} // TODO\n';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"val"}');
    });

    it('removes block comments', () => {
      const input = '{/* comment */"key":"val"}';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"val"}');
    });

    it('strips explanatory text before first brace', () => {
      const input = 'Here is your config:\n{"key":"value"}';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('strips trailing text after last brace', () => {
      const input = '{"key":"value"}\nLet me know if this works.';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('normalizes Windows line endings', () => {
      const input = '{"key":"value"}\r\n';
      const result = preprocessAIRawJSON(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('is idempotent -- running twice gives same result', () => {
      const input = '```json\n{"key":"value",}\n```';
      const once = preprocessAIRawJSON(input);
      const twice = preprocessAIRawJSON(once);
      expect(twice).toBe(once);
    });
  });

  // -----------------------------------------------------------------------
  // Schema validation tests
  // -----------------------------------------------------------------------

  describe('validateConfig', () => {

    it('accepts valid minimal manifest', () => {
      const valid = `{
        "version": "2.0",
        "organization": { "id": "org-1", "name": "Test", "type": "church" },
        "features": {},
        "roles": []
      }`;

      const result = validateConfig(valid, manifestSchema, 'minimal-manifest');
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result as any).data.organization.type).toBe('church');
      }
    });

    it('rejects missing required field (version)', () => {
      const incomplete = `{
        "organization": { "id": "x", "name": "y", "type": "church" },
        "features": {},
        "roles": []
      }`;

      const result = validateConfig(incomplete, manifestSchema, 'incomplete-manifest');
      expect(result.success).toBe(false);
    });

    it('rejects extra top-level properties when additionalProperties:false', () => {
      const extra = `{
        "version": "2.0",
        "organization": { "id": "x", "name": "y", "type": "church" },
        "features": {},
        "roles": [],
        "unknown_field": "should fail"
      }`;

      const result = validateConfig(extra, manifestSchema, 'extra-fields-manifest');
      expect(result.success).toBe(false);
      expect(result.tier).toBe('schema-failed');
    });

    it('rejects invalid organization type', () => {
      const badType = `{
        "version": "2.0",
        "organization": { "id": "x", "name": "y", "type": "hospital" },
        "features": {},
        "roles": []
      }`;

      const result = validateConfig(badType, manifestSchema, 'bad-type-manifest');
      expect(result.success).toBe(false);
    });

    it('handles AI-generated output with markdown fences', () => {
      const aiOutput = `\`\`\`json
{
  "version": "2.0",
  "organization": { "id": "org-ai", "name": "AI Org", "type": "church" },
  "features": {},
  "roles": []
}
\`\`\``;

      const result = validateConfig(aiOutput, manifestSchema, 'ai-manifest');
      expect(result.success).toBe(true);
      expect(result.tier).toBe('preprocessed');
    });

    it('handles AI-generated output with trailing commas', () => {
      const aiOutput = `{
  "version": "2.0",
  "organization": { "id": "x", "name": "y", "type": "church", },
  "features": {},
  "roles": []
}`;

      const result = validateConfig(aiOutput, manifestSchema, 'trailing-comma-manifest');
      expect(result.success).toBe(true);
    });

    it('preprocessing + AJV catch errors that preprocessing cannot fix', () => {
      const nonsense = `Sure, here is your manifest:
This is just random text with no structure whatsoever.`;

      const result = validateConfig(nonsense, manifestSchema, 'nonsense');
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Performance tests
  // -----------------------------------------------------------------------

  describe('AJV performance', () => {

    it('compiles schema quickly (< 500ms)', () => {
      // Seuil volontairement permissif : la première compilation froide AJV
      // subit le warm-up JIT et peut dépasser 50ms sur machine chargée.
      const start = Date.now();
      ajv.compile(manifestSchema);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('validates 1000 times in under 100ms total (~0.1ms per call)', () => {
      const validate = ajv.compile(manifestSchema);
      const data = {
        version: '2.0',
        organization: { id: 'x', name: 'y', type: 'church' },
        features: {},
        roles: [],
      };

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        validate(data);
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});
