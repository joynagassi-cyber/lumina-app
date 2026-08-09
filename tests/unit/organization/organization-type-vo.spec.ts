/**
 * OrganizationType Value Object Tests
 *
 * Tests validation and behavior of OrganizationType VO.
 * @traceability DOC-012 BR-ORG-001, CANONICAL-DOMAIN-MODEL §VO-OrganizationType
 */

import {
  OrganizationType,
  assertValidOrganizationType,
  InvalidOrganizationTypeError,
} from '@/domains/organization/domain/value-objects/organization-type.vo';

describe('OrganizationType', () => {
  it('should define valid type values', () => {
    expect(Object.values(OrganizationType)).toEqual(
      expect.arrayContaining(['church', 'school', 'ngo', 'company', 'custom']),
    );
  });

  it('should assert valid type "church"', () => {
    const result = assertValidOrganizationType('church');
    expect(result).toBe(OrganizationType.Church);
  });

  it('should assert valid type "school"', () => {
    const result = assertValidOrganizationType('school');
    expect(result).toBe(OrganizationType.School);
  });

  it('should assert valid type "ngo"', () => {
    const result = assertValidOrganizationType('ngo');
    expect(result).toBe(OrganizationType.Ngo);
  });

  it('should assert valid type "company"', () => {
    const result = assertValidOrganizationType('company');
    expect(result).toBe(OrganizationType.Company);
  });

  it('should assert valid type "custom"', () => {
    const result = assertValidOrganizationType('custom');
    expect(result).toBe(OrganizationType.Custom);
  });

  it('should throw error for invalid type', () => {
    expect(() => assertValidOrganizationType('invalid')).toThrow(InvalidOrganizationTypeError);
    expect(() => assertValidOrganizationType('invalid')).toThrow(
      `Invalid organization type: "invalid". Must be one of: church, school, ngo, company, custom`,
    );
  });

  it('should throw error for uppercase type', () => {
    expect(() => assertValidOrganizationType('Church')).toThrow(InvalidOrganizationTypeError);
  });

  it('should throw error for empty string', () => {
    expect(() => assertValidOrganizationType('')).toThrow(InvalidOrganizationTypeError);
  });
});
