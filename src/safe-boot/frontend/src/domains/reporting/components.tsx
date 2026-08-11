/**
 * Reporting Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 10 (ReportingAggregate)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SelectField } from '@/components/ui';
import type {
  GenerateReportInput,
  ReportDefinition,
  ReportGenerated,
  ReportInstanceWithPreview,
  ReportType,
  ReportPeriod,
} from './types';

/* ------------------------------------------------------------------ */
/*  ReportGenerator                                                    */
/* ------------------------------------------------------------------ */

export interface ReportGeneratorProps {
  definitions: ReadonlyArray<ReportDefinition>;
  isLoading?: boolean;
  error?: string;
  onGenerate?: (input: Omit<GenerateReportInput, 'organizationId'>) => Promise<ReportGenerated>;
}

export function ReportGenerator({
  definitions,
  isLoading = false,
  error,
  onGenerate,
}: ReportGeneratorProps): React.ReactElement | null {
  const [form, setForm] = useState<{
    definitionId: string | null;
    periodStart: string;
    periodEnd: string;
    period: ReportPeriod;
    includeAttachments: boolean;
  }>({
    definitionId: null,
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    period: 'monthly',
    includeAttachments: false,
  });

  const handleGenerate = async () => {
    if (!form.definitionId || !form.periodStart || !form.periodEnd) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    if (onGenerate) {
      await onGenerate({
        reportDefinitionId: form.definitionId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        period: form.period,
        includeAttachments: form.includeAttachments,
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (definitions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No report templates available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.generatorContainer}>
      <Text style={styles.generatorTitle}>Generate Report</Text>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Report Type</Text>
        <SelectField
          value={form.definitionId || ''}
          placeholder="Select a report"
          options={definitions.map((def) => ({ value: def.id, label: def.title }))}
          onChange={(v) => setForm({...form, definitionId: v})}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Period</Text>
        <SelectField
          value={form.period}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
          onChange={(v) => setForm({...form, period: v as ReportPeriod})}
        />
      </View>

      <View style={styles.dateGroup}>
        <Text style={styles.formLabel}>From</Text>
        <TextInput
          style={styles.input}
          value={form.periodStart}
          onChangeText={(v) => setForm({...form, periodStart: v})}
        />
      </View>

      <View style={styles.dateGroup}>
        <Text style={styles.formLabel}>To</Text>
        <TextInput
          style={styles.input}
          value={form.periodEnd}
          onChangeText={(v) => setForm({...form, periodEnd: v})}
        />
      </View>

      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => setForm({...form, includeAttachments: !form.includeAttachments})}
      >
        <View style={[styles.checkbox, form.includeAttachments && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>Include Attachments (PDF/Excel)</Text>
      </TouchableOpacity>

      <Pressable
        style={styles.generateButton}
        onPress={handleGenerate}
        disabled={!form.definitionId}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.generateButtonText}>Generate Report</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  ReportViewer                                                       */
/* ------------------------------------------------------------------ */

export interface ReportViewerProps {
  instance: ReportInstanceWithPreview | null;
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onDownload?: () => void;
  onBack?: () => void;
}

export function ReportViewer({
  instance,
  isLoading = false,
  error,
  onRefresh,
  onDownload,
  onBack,
}: ReportViewerProps): React.ReactElement | null {
  if (!instance) {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Report not found</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.viewerContainer}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.viewerTitle}>Report Preview</Text>

      <View style={styles.reportInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Report:</Text>
          <Text style={styles.infoValue}>{instance.report.type}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Period:</Text>
          <Text style={styles.infoValue}>{instance.report.periodStart} — {instance.report.periodEnd}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, styles[stateTagStyle(instance.report.status)]]}>{instance.report.status}</Text>
        </View>
      </View>

      <View style={styles.dataPreview}>
        <Text style={styles.dataPreviewTitle}>Generated Data</Text>
        <View style={styles.dataContent}>
          <Text style={styles.dataText}>{instance.preview}</Text>
        </View>
      </View>

      <View style={styles.viewerActions}>
        {onRefresh && (
          <Pressable
            style={styles.actionButton}
            onPress={onRefresh}
          >
            <Text style={styles.actionButtonText}>Refresh</Text>
          </Pressable>
        )}
        {onDownload && (
          <Pressable
            style={[styles.actionButton, styles.downloadButton]}
            onPress={onDownload}
          >
            <Text style={styles.actionButtonText}>Download</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  ReportList                                                         */
/* ------------------------------------------------------------------ */

export interface ReportListProps {
  instances: ReadonlyArray<ReportInstanceWithPreview>;
  isLoading?: boolean;
  error?: string;
  onSelect?: (instance: ReportGenerated) => void;
  onGenerate?: () => void;
}

export function ReportList({
  instances,
  isLoading = false,
  error,
  onSelect,
  onGenerate,
}: ReportListProps): React.ReactElement | null {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (instances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No reports generated</Text>
        {onGenerate && (
          <Pressable style={styles.generateLink} onPress={onGenerate}>
            <Text style={styles.generateLinkText}>Generate First Report</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <Pressable
        style={styles.addButton}
        onPress={onGenerate}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>

      <FlatList
        data={instances}
        keyExtractor={(i) => i.report.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.reportItem}
            onPress={() => onSelect?.(item.report)}
          >
            <View style={styles.reportItemInfo}>
              <Text style={styles.reportTitle}>{item.report.type}</Text>
              <Text style={styles.reportMeta}>
                {item.report.period} • {new Date(item.report.generatedAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.reportStatus}>
              <Text style={[styles.stateTag, styles[stateTagStyle(item.report.status)]]}>
                {item.report.status}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function stateTagStyle(status: ReportGenerated['status']): keyof typeof styles {
  const styleMap: Record<ReportGenerated['status'], keyof typeof styles> = {
    draft: 'draftTag',
    generated: 'generatedTag',
    failed: 'failedTag',
    archived: 'archivedTag',
  };
  return styleMap[status] || 'draftTag';
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  generatorContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  viewerContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  listContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: { color: '#ff6b6b', fontSize: 14 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: { color: '#888', fontSize: 16 },
  generatorTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  viewerTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  formGroup: { marginBottom: 16 },
  dateGroup: { marginBottom: 16 },
  formLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    borderColor: '#333',
    borderWidth: 1,
    color: '#ffffff',
  },
  picker: {
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    height: 50,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
  },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderColor: '#6366f1', borderWidth: 2 },
  checkboxChecked: { backgroundColor: '#6366f1' },
  checkboxLabel: { color: '#ffffff', fontSize: 16 },
  generateButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  generateButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  backButton: { marginBottom: 16 },
  backButtonText: { color: '#6366f1', fontSize: 16 },
  reportInfo: { marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: '#888', fontSize: 12 },
  infoValue: { color: '#ffffff', fontSize: 12 },
  dataPreview: { marginBottom: 16 },
  dataPreviewTitle: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  dataContent: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 8,
    maxHeight: 200,
  },
  dataText: { color: '#888', fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
  viewerActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButton: { backgroundColor: '#9C27B0' },
  actionButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  addButton: {
    backgroundColor: '#6366f1',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    alignSelf: 'flex-end',
  },
  addButtonText: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  reportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
    borderRadius: 8,
  },
  reportItemInfo: { flex: 1 },
  reportTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  reportMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  reportStatus: { marginLeft: 16 },
  stateTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  draftTag: { backgroundColor: '#FF9800', color: '#000' },
  generatedTag: { backgroundColor: '#4CAF50', color: '#fff' },
  failedTag: { backgroundColor: '#F44336', color: '#fff' },
  archivedTag: { backgroundColor: '#888', color: '#fff' },
  generateLink: { marginTop: 24 },
  generateLinkText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
});