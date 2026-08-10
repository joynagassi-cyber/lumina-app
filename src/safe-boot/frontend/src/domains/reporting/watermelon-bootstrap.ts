/**
 * WatermelonDB Initialization for Reporting Module
 * Initialize SQLite adapter and create the reporting database
 */

import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import ReportingWatermelonService, {
  type ReportTemplate,
  type ReportInstance,
  type ReportSnapshot,
} from './watermelon-service';
import {
  getReportInstanceSchema,
  getReportSnapshotSchema,
  getReportDefinitionSchema,
} from './watermelon';

// WatermelonDB column types: 'string' | 'number' | 'boolean'
const columnType = (type: string): 'string' | 'number' | 'boolean' => {
  if (type === 'integer') return 'number';
  return 'string';
};

const toTableSchema = (
  schema: { name: string; columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }> }
) =>
  tableSchema({
    name: schema.name,
    columns: schema.columns.map((column) => ({
      name: column.name,
      type: columnType(column.type),
      isIndexed: column.isIndexed,
      isOptional: column.isNullable,
    })),
  });

// Create SQLite adapter (configuration for Expo/WatermelonDB)
export const sqliteAdapter = new SQLiteAdapter({
  dbName: 'lumina_report_db',
  schema: appSchema({
    version: 1,
    tables: [
      toTableSchema(getReportDefinitionSchema()),
      toTableSchema(getReportInstanceSchema()),
      toTableSchema(getReportSnapshotSchema()),
    ],
  }),
});

// Initialize the service (called on app startup)
export const initializeReportingWatermelon = (): ReportingWatermelonService => {
  // Create the adapter (this needs to be properly configured for Expo)
  // For now, using basic SQLite adapter - in production, use Expo SQLite module
  const adapter = sqliteAdapter;

  // Create and return the service
  return new ReportingWatermelonService(adapter);
};

// Export for use in the app bootstrap
export { ReportingWatermelonService, type ReportTemplate, type ReportInstance, type ReportSnapshot };
export default initializeReportingWatermelon;
