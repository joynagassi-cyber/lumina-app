/**
 * FieldDef Value Object Tests
 *
 * Tests form field definition validation and behavior.
 * @traceability DOC-012 BR-FRM-001, VO-FieldDef
 */

import { FieldDef, InvalidFieldDefError, InvalidFieldTypeError, assertValidFieldType, VALID_FIELD_TYPES } from '@/domains/form/domain/value-objects/field-def.vo';

describe('FieldDef', () => {
  // Valid field types
  it('should define all valid field types', () => {
    expect(VALID_FIELD_TYPES).toEqual([
      'text',
      'number',
      'date',
      'select',
      'multiselect',
      'file_upload',
      'signature',
      'textarea',
    ]);
  });

  it('should assert valid field type "text"', () => {
    const result = assertValidFieldType('text');
    expect(result).toBe('text');
  });

  it('should assert valid field type "number"', () => {
    const result = assertValidFieldType('number');
    expect(result).toBe('number');
  });

  it('should create field with valid properties', () => {
    const field = new FieldDef({
      name: 'email',
      labelFr: 'Email',
      labelEn: 'Email',
      type: 'text',
      required: true,
      pattern: '^[^@]+@[^@]+\\.[^@]+$',
      max: 255,
    });

    expect(field.name).toBe('email');
    expect(field.labelFr).toBe('Email');
    expect(field.type).toBe('text');
    expect(field.required).toBe(true);
    expect(field.pattern).toBe('^[^@]+@[^@]+\\.[^@]+$');
    expect(field.max).toBe(255);
  });

  // Invalid field creations
  it('should reject empty field name', () => {
    expect(() => new FieldDef({
      name: '',
      labelFr: 'Label',
      labelEn: 'Label',
      type: 'text',
    })).toThrow(InvalidFieldDefError);
  });

  it('should reject missing labelFr', () => {
    expect(() => new FieldDef({
      name: 'field1',
      labelFr: '',
      labelEn: 'Label',
      type: 'text',
    })).toThrow(InvalidFieldDefError);
  });

  it('should reject invalid field type', () => {
    expect(() => new FieldDef({
      name: 'field1',
      labelFr: 'Label',
      labelEn: 'Label',
      type: 'invalid' as any,
    })).toThrow(InvalidFieldTypeError);
  });

  it('should require sourceVocabulary for select type (BR-FRM-001)', () => {
    expect(() => new FieldDef({
      name: 'country',
      labelFr: 'Pays',
      labelEn: 'Country',
      type: 'select',
      required: true,
    })).toThrow(InvalidFieldDefError);
  });

  it('should accept select with sourceVocabulary', () => {
    const field = new FieldDef({
      name: 'country',
      labelFr: 'Pays',
      labelEn: 'Country',
      type: 'select',
      sourceVocabulary: 'countries',
    });
    expect(field.sourceVocabulary).toBe('countries');
  });

  // Default values
  it('should set default required to false', () => {
    const field = new FieldDef({
      name: 'field1',
      labelFr: 'Label',
      labelEn: 'Label',
      type: 'text',
    });
    expect(field.required).toBe(false);
  });

  it('should set default pattern to null', () => {
    const field = new FieldDef({
      name: 'field1',
      labelFr: 'Label',
      labelEn: 'Label',
      type: 'text',
    });
    expect(field.pattern).toBeNull();
  });

  it('should set default min to null', () => {
    const field = new FieldDef({
      name: 'field1',
      labelFr: 'Label',
      labelEn: 'Label',
      type: 'number',
    });
    expect(field.min).toBeNull();
  });

  // Label retrieval
  it('should return correct label based on language', () => {
    const field = new FieldDef({
      name: 'field1',
      labelFr: 'Libellé Fr',
      labelEn: 'Label En',
      type: 'text',
    });
    expect(field.getLabel('fr')).toBe('Libellé Fr');
    expect(field.getLabel('en')).toBe('Label En');
  });

  // Equality
  it('should compare equality by name and type', () => {
    const field1 = new FieldDef({ name: 'f1', labelFr: 'F1', labelEn: 'F1', type: 'text' });
    const field2 = new FieldDef({ name: 'f1', labelFr: 'F1', labelEn: 'F1', type: 'text' });
    const field3 = new FieldDef({ name: 'f2', labelFr: 'F2', labelEn: 'F2', type: 'text' });

    expect(field1.equals(field2)).toBe(true);
    expect(field1.equals(field3)).toBe(false);
  });
});
