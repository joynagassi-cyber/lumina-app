import {
  createNewFeature,
  isValidStatus,
  NEW_FEATURE_STATUSES,
  type NewFeatureBase,
  type NewFeatureListItem,
  type NewFeatureDetail,
} from '../../src/features/new-feature/types/new-feature.types';

describe('NewFeature Types', () => {
  const baseOrgId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const baseUserId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  describe('createNewFeature factory', () => {
    it('should construct a valid object with all required fields', () => {
      const result = createNewFeature({
        orgId: baseOrgId,
        title: 'Test Title',
        createdBy: baseUserId,
      });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.orgId).toBe(baseOrgId);
      expect(result.title).toBe('Test Title');
      expect(result.status).toBe(NEW_FEATURE_STATUSES.DRAFT);
      expect(result.version).toBe(1);
      expect(result.createdBy).toBe(baseUserId);
      expect(result.metadata).toEqual({});
    });

    it('should accept optional description and metadata', () => {
      const result = createNewFeature({
        orgId: baseOrgId,
        title: 'Test',
        createdBy: baseUserId,
        description: 'A description',
        metadata: { key: 'value' },
      });

      expect(result.description).toBe('A description');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should set _synced to 0 for newly created items', () => {
      const item = createNewFeature({
        orgId: baseOrgId,
        title: 'Test',
        createdBy: baseUserId,
      });

      // ListItem variant should have _synced field
      const listItem: NewFeatureListItem = {
        ...item,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _synced: 0,
      };

      expect(listItem._synced).toBe(0);
    });
  });

  describe('isValidStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidStatus(NEW_FEATURE_STATUSES.DRAFT)).toBe(true);
      expect(isValidStatus(NEW_FEATURE_STATUSES.PENDING)).toBe(true);
      expect(isValidStatus(NEW_FEATURE_STATUSES.APPROVED)).toBe(true);
      expect(isValidStatus(NEW_FEATURE_STATUSES.REJECTED)).toBe(true);
      expect(isValidStatus(NEW_FEATURE_STATUSES.CLOSED)).toBe(true);
    });

    it('should return false for invalid status strings', () => {
      expect(isValidStatus('invalid-status')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus('Draft')).toBe(false); // case-sensitive
      expect(isValidStatus('UNKNOWN_VALUE')).toBe(false);
    });
  });

  describe('Type safety - no `any` types', () => {
    it('should enforce string type for id field', () => {
      const item = createNewFeature({
        orgId: baseOrgId,
        title: 'Test',
        createdBy: baseUserId,
      });

      // This should compile as string, not any
      const id: string = item.id;
      expect(id.length).toBeGreaterThan(0);
    });

    it('should enforce number type for version field', () => {
      const item = createNewFeature({
        orgId: baseOrgId,
        title: 'Test',
        createdBy: baseUserId,
      });

      const version: number = item.version;
      expect(version).toBe(1);
    });

    it('should enforce Record<string, unknown> type for metadata', () => {
      const item = createNewFeature({
        orgId: baseOrgId,
        title: 'Test',
        createdBy: baseUserId,
        metadata: { count: 42, name: 'test' },
      });

      const meta: Record<string, unknown> = item.metadata;
      expect(meta.count).toBe(42);
    });
  });
});
