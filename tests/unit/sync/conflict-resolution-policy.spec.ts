/**
 * ConflictResolutionPolicy Tests
 *
 * Tests conflict strategy resolution per resource type.
 * @traceability DOC-012 BR-SYNC-002 through BR-SYNC-005, ConflictResolutionPolicy
 */

import { ConflictResolutionPolicy, CONFLICT_RESOLUTION_MATRIX } from '@/domains/sync/policies/conflict-resolution-policy';
import { ConflictStrategy } from '@/domains/sync/value-objects/conflict-strategy.vo';

describe('ConflictResolutionPolicy', () => {
  describe('getStrategy', () => {
    it('should return UUID_DEDUP for draft transactions', () => {
      const strategy = ConflictResolutionPolicy.getStrategy('transaction', 'draft');
      expect(strategy).toBe(ConflictStrategy.UUID_DEDUP);
    });

    it('should return IMMUTABLE for approved transactions', () => {
      const strategy = ConflictResolutionPolicy.getStrategy('transaction', 'approved');
      expect(strategy).toBe(ConflictStrategy.IMMUTABLE);
    });

    it('should return LAST_WRITE_WINS for members', () => {
      const strategy = ConflictResolutionPolicy.getStrategy('member');
      expect(strategy).toBe(ConflictStrategy.LAST_WRITE_WINS);
    });

    it('should return LAST_WRITE_WINS for events', () => {
      const strategy = ConflictResolutionPolicy.getStrategy('event');
      expect(strategy).toBe(ConflictStrategy.LAST_WRITE_WINS);
    });

    it('should return SERVER_WINS for archive entries', () => {
      const strategy = ConflictResolutionPolicy.getStrategy('archive_entry');
      expect(strategy).toBe(ConflictStrategy.SERVER_WINS);
    });

    it('should return SERVER_WINS for unknown resource types', () => {
      const strategy = ConflictResolutionPolicy.getStrategy('unknown-resource');
      expect(strategy).toBe(ConflictStrategy.SERVER_WINS);
    });

    it('should use provided transactionState to override for transactions', () => {
      const strategyDraft = ConflictResolutionPolicy.getStrategy('transaction', 'draft');
      const strategyPending = ConflictResolutionPolicy.getStrategy('transaction', 'pending');

      expect(strategyDraft).toBe(ConflictStrategy.UUID_DEDUP);
      expect(strategyPending).toBe(ConflictStrategy.IMMUTABLE); // pending is not draft, so IMMUTABLE
    });
  });

  describe('isImmutableViolation', () => {
    it('should detect violation for approved transaction mutation', () => {
      const result = ConflictResolutionPolicy.isImmutableViolation('transaction', 'approved');
      expect(result).toBe(true);
    });

    it('should NOT detect violation for draft transaction', () => {
      const result = ConflictResolutionPolicy.isImmutableViolation('transaction', 'draft');
      expect(result).toBe(false);
    });

    it('should NOT detect violation for non-transaction resource types', () => {
      const result1 = ConflictResolutionPolicy.isImmutableViolation('member', 'active');
      const result2 = ConflictResolutionPolicy.isImmutableViolation('event', 'scheduled');
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should NOT detect violation when state is undefined', () => {
      const result = ConflictResolutionPolicy.isImmutableViolation('transaction', undefined);
      expect(result).toBe(false);
    });
  });

  describe('hasRegisteredStrategy', () => {
    it('should return true for registered resource types', () => {
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('transaction')).toBe(true);
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('member')).toBe(true);
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('event')).toBe(true);
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('archive_entry')).toBe(true);
    });

    it('should return false for unregistered resource types', () => {
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('organization')).toBe(false);
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('user')).toBe(false);
      expect(ConflictResolutionPolicy.hasRegisteredStrategy('unknown')).toBe(false);
    });
  });

  describe('CONFLICT_RESOLUTION_MATRIX', () => {
    it('should contain all expected entries', () => {
      expect(CONFLICT_RESOLUTION_MATRIX).toHaveLength(4);
      expect(CONFLICT_RESOLUTION_MATRIX.map(e => e.resourceType)).toContain('transaction');
      expect(CONFLICT_RESOLUTION_MATRIX.map(e => e.resourceType)).toContain('member');
      expect(CONFLICT_RESOLUTION_MATRIX.map(e => e.resourceType)).toContain('event');
      expect(CONFLICT_RESOLUTION_MATRIX.map(e => e.resourceType)).toContain('archive_entry');
    });

    it('should have correct strategy for each resource type', () => {
      const transactionEntry = CONFLICT_RESOLUTION_MATRIX.find(e => e.resourceType === 'transaction');
      const memberEntry = CONFLICT_RESOLUTION_MATRIX.find(e => e.resourceType === 'member');
      const eventEntry = CONFLICT_RESOLUTION_MATRIX.find(e => e.resourceType === 'event');
      const archiveEntry = CONFLICT_RESOLUTION_MATRIX.find(e => e.resourceType === 'archive_entry');

      expect(transactionEntry?.strategy).toBe(ConflictStrategy.IMMUTABLE);
      expect(memberEntry?.strategy).toBe(ConflictStrategy.LAST_WRITE_WINS);
      expect(eventEntry?.strategy).toBe(ConflictStrategy.LAST_WRITE_WINS);
      expect(archiveEntry?.strategy).toBe(ConflictStrategy.SERVER_WINS);
    });
  });
});
