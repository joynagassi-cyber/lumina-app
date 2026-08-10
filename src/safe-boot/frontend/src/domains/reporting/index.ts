/**
 * Reporting Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 10 (ReportingAggregate)
 */

export type {
  GenerateReportInput,
  ListReportsDefinitionInput,
  ListReportInstancesInput,
  ReportDefinition,
  ReportGenerated,
  ReportInstanceWithPreview,
  ReportPeriod,
  ReportSnapshot,
  ReportType,
} from './types';

export {
  reportingApi,
  useListReportDefinitionsQuery,
  useGetReportDefinitionQuery,
  useListReportInstancesQuery,
  useGetReportInstanceQuery,
  useGetReportSnapshotQuery,
  useListReportSnapshotsQuery,
  useGenerateReportMutation,
  useDownloadReportMutation,
  useUpdateReportInstanceStatusMutation,
  useDeleteReportInstanceMutation,
  useCreateSnapshotMutation,
  usePurgeReportInstanceMutation,
} from './api';

import reportingReducer from './store';
export default reportingReducer;

export { useReports, useReportSnapshot, useGenerateReport } from './hooks';

export { getReportInstanceSchema, getReportSnapshotSchema, getReportDefinitionSchema } from './watermelon';

export { ReportGenerator, ReportViewer, ReportList, ReportTableRenderer, QueryBuilderVisualEditor } from './components/index';

// Services
export { ExportService, exportService, type ExportFormat } from './services/ExportService';