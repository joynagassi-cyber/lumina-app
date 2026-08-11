/**
 * ExportService Unit Tests
 * @traceable flexible-report-engine-arch.md §Tests Exports
 */

import { ExportService, exportService, type ExportFormat } from '../services/ExportService';
import type { ReportGenerated } from '../types';

// Mock ReportGenerated for testing
const mockReport: ReportGenerated = {
  id: 'test-123',
  reportDefinitionId: 'def-1',
  organizationId: 'org-1',
  periodStart: '2024-01-01',
  periodEnd: '2024-01-31',
  period: 'monthly',
  type: 'balance_sheet',
  data: { total_income: 1000, total_expense: 500, net_result: 500 },
  status: 'generated',
  generatedBy: 'user-1',
  generatedAt: new Date().toISOString(),
  expiresAt: null,
  version: 1,
  synced: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  describe('downloadCSV', () => {
    it('should generate CSV from report data', async () => {
      const report = { ...mockReport, data: { name: 'John', age: 30, city: 'Paris' } };
      const blob = await service.downloadCSV(report);
      const text = await blob.text();
      expect(text).toContain('name');
      expect(text).toContain('age');
      expect(text).toContain('city');
      expect(text).toContain('John');
      expect(text).toContain('30');
      expect(text).toContain('Paris');
    });

    it('should handle empty data', async () => {
      const report = { ...mockReport, data: {} };
      await expect(service.downloadCSV(report)).rejects.toThrow('Aucun données à exporter');
    });
  });

  describe('downloadJSON', () => {
    it('should generate JSON from report', async () => {
      const blob = await service.downloadJSON(mockReport);
      const text = await blob.text();
      const json = JSON.parse(text);
      expect(json.id).toBe('test-123');
      expect(json.data).toEqual(mockReport.data);
    });
  });

  describe('downloadPDF', () => {
    it('should throw error - not implemented', async () => {
      await expect(service.downloadPDF(mockReport)).rejects.toThrow('Le générateur PDF n\'est pas encore implémenté');
    });
  });

  describe('downloadExcel', () => {
    it('should throw error - not implemented', async () => {
      await expect(service.downloadExcel(mockReport)).rejects.toThrow('Le générateur Excel n\'est pas encore implémenté');
    });
  });

  describe('getPrintPreview', () => {
    it('should generate HTML preview', async () => {
      const html = await service.getPrintPreview(mockReport);
      expect(html).toContain(`<h1>${mockReport.type}</h1>`);
      expect(html).toContain('Generated:');
    });
  });

  describe('exportReport', () => {
    it('should export CSV format', async () => {
      const blob = await service.exportReport(mockReport, 'csv', { fileName: 'test.csv' });
      expect((blob as unknown as { name: string }).name).toBe('test.csv');
      expect(blob.type).toContain('text/csv');
    });

    it('should export JSON format', async () => {
      const blob = await service.exportReport(mockReport, 'json', { fileName: 'test.json' });
      expect((blob as unknown as { name: string }).name).toBe('test.json');
      expect(blob.type).toBe('application/json');
    });

    it('should throw error for unsupported format', async () => {
      await expect(service.exportReport(mockReport, 'zip' as ExportFormat)).rejects.toThrow('Format non supporté');
    });
  });

  describe('instance exportService', () => {
    it('should be a singleton instance', () => {
      expect(exportService).toBeInstanceOf(ExportService);
    });
  });
});
