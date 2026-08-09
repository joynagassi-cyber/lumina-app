/**
 * OrganizationName Value Object Tests
 *
 * Tests validation and behavior of OrganizationName VO.
 * @traceability DOC-012 BR-ORG-001, CANONICAL-DOMAIN-MODEL §VO-OrganizationName
 */

import { OrganizationName, InvalidOrganizationNameError } from '@/domains/organization/domain/value-objects/organization-name.vo';

describe('OrganizationName', () => {
  it('should create from valid string', () => {
    const name = new OrganizationName('Test Organization');
    expect(name.value).toBe('Test Organization');
  });

  it('should trim whitespace from input', () => {
    const name = new OrganizationName('  Test Organization  ');
    expect(name.value).toBe('Test Organization');
  });

  it('should reject empty string', () => {
    expect(() => new OrganizationName('')).toThrow(InvalidOrganizationNameError);
  });

  it('should reject null', () => {
    // @ts-ignore - testing intentional type misuse
    expect(() => new OrganizationName(null)).toThrow(InvalidOrganizationNameError);
  });

  it('should reject undefined', () => {
    // @ts-ignore
    expect(() => new OrganizationName(undefined)).toThrow(InvalidOrganizationNameError);
  });

  it('should reject whitespace-only string', () => {
    expect(() => new OrganizationName('   ')).toThrow(InvalidOrganizationNameError);
  });

  it('should reject exceeding max length (255 chars)', () => {
    const longValue = 'a'.repeat(256);
    expect(() => new OrganizationName(longValue)).toThrow(InvalidOrganizationNameError);
  });

  it('should accept exactly max length (255 chars)', () => {
    const longValue = 'a'.repeat(255);
    const name = new OrganizationName(longValue);
    expect(name.value.length).toBe(255);
  });

  it('should compare equality correctly', () => {
    const name1 = new OrganizationName('Test Org');
    const name2 = new OrganizationName('Test Org');
    expect(name1.equals(name2)).toBe(true);
  });

  it('should return different equality for different values', () => {
    const name1 = new OrganizationName('Test Org 1');
    const name2 = new OrganizationName('Test Org 2');
    expect(name1.equals(name2)).toBe(false);
  });

  it('should convert to string correctly', () => {
    const name = new OrganizationName('Test Organization');
    expect(name.toString()).toBe('Test Organization');
  });
});
