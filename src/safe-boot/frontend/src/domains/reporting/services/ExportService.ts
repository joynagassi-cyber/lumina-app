/** ExportService - Export service for reports */

import type { ReportGenerated } from '../types';

export type ExportFormat = 'pdf' | 'csv' | 'excel' | 'json' | 'print';

interface ExportOptions {
  fileName?: string;
  includeMetadata?: boolean;
  sheetName?: string;
  orientation?: 'portrait' | 'landscape';
}

class ExportError extends Error {
  constructor(message: string, public format?: ExportFormat) {
    super(message);
    this.name = 'ExportError';
  }
}

export class ExportService {
  async downloadPDF(report: ReportGenerated, options: ExportOptions = {}): Promise<Blob> {
    throw new ExportError('Le générateur PDF n\'est pas encore implémenté', 'pdf');
  }

  async downloadCSV(report: ReportGenerated, options: ExportOptions = {}): Promise<Blob> {
    const data = report.data || {};
    const lines = Object.keys(data).map(key => key);
    if (lines.length === 0) {
      throw new ExportError('Aucun données à exporter', 'csv');
    }
    const csvContent = lines.join(',') + '\n' + Object.values(data).join(',');
    return new Blob([csvContent], { type: 'text/csv' });
  }

  async downloadExcel(report: ReportGenerated, options: ExportOptions = {}): Promise<Blob> {
    throw new ExportError('Le générateur Excel n\'est pas encore implémenté', 'excel');
  }

  async downloadJSON(report: ReportGenerated, options: ExportOptions = {}): Promise<Blob> {
    const payload = {
      ...report,
      data: typeof report.data === 'string' ? JSON.parse(report.data) : report.data,
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  async getPrintPreview(report: ReportGenerated): Promise<string> {
    return `<html><head><title>${report.type || 'Report'}</title></head><body>${this.formatReportAsHTML(report)}</body></html>`;
  }

  private formatReportAsHTML(report: ReportGenerated): string {
    const data = report.data || {};
    return `<h1>${report.type || 'Report'}</h1><p>Generated: ${new Date().toLocaleDateString()}</p><p>Period: ${report.periodStart} - ${report.periodEnd}</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  async downloadBlob(blob: Blob, fileName: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async exportReport(report: ReportGenerated, format: ExportFormat, options: ExportOptions = {}): Promise<Blob> {
    const fileName = options.fileName || `report-${new Date().toISOString().split('T')[0]}.${format}`;

    try {
      let blob: Blob;
      switch (format) {
        case 'pdf': blob = await this.downloadPDF(report, options); break;
        case 'csv': blob = await this.downloadCSV(report, options); break;
        case 'excel': blob = await this.downloadExcel(report, options); break;
        case 'json': blob = await this.downloadJSON(report, options); break;
        default: throw new ExportError('Format non supporté', format);
      }
      return Object.assign(blob, { name: fileName });
    } catch (error) {
      // ExportError carries the domain message (e.g. 'Format non supporté') — propagate it.
      if (error instanceof ExportError) throw error;
      console.error('Export error:', error);
      throw new Error(`Export failed for format ${format}: ${(error as Error).message}`);
    }
  }
}

export const exportService = new ExportService();
export default ExportService;
