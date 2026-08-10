/**
 * ReportPage — Page complète pour le Flexible Report Engine
 * Combines the query builder, table renderer, and export functionality
 * @traceable flexible-report-engine-arch.md §Dashboard
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import type { ReportGenerated } from '../types';
import { useReports } from '../hooks';
import { QueryBuilderVisualEditor } from '../components/QueryBuilderVisualEditor';
import { ReportTableRenderer } from '../components/ReportTableRenderer';
import { ChartRendererMobile } from '../components/ChartRendererMobile';
import { exportService, type ExportFormat } from '../services/ExportService';

// Dimensions de l'écran
const { width } = Dimensions.get('window');

interface ReportPageProps {
  organizationId: string;
  onBack?: () => void;
  style?: any;
}

export function ReportPage({ organizationId, onBack, style }: ReportPageProps) {
  const { definitions, instances, isLoading, error } = useReports(organizationId);
  const [customQuery, setCustomQuery] = useState<any>(null);

  // Handler pour changer la requête depuis l'éditeur
  const handleQueryChange = useCallback((query: any) => {
    setCustomQuery(query);
  }, []);

  // Handler pour exporter
  const handleExport = async (format: ExportFormat) => {
    try {
      // Ici, on appellerait l'API backend pour générer le rapport avec la requête custom
      // Pour le Sprint 2, on simule avec un rapport générique
      const sampleReport: ReportGenerated = {
        id: 'sample-123',
        reportDefinitionId: 'sample-def',
        organizationId,
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        period: 'yearly',
        type: 'custom',
        data: { sample: 'data' },
        status: 'generated',
        generatedBy: 'current-user',
        generatedAt: new Date().toISOString(),
        expiresAt: null,
        version: 1,
        synced: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const blob = await exportService.exportReport(sampleReport, format, { fileName: `rapport-${format}` });
      await exportService.downloadBlob(blob, `rapport-${format}`);
      Alert.alert('Succès', `Le rapport a été téléchargé au format ${format}`);
    } catch (err) {
      Alert.alert('Erreur', `Échec de l'export: ${(err as Error).message}`);
    }
  };

  // Boutons d'export
  const exportButtons = () => (
    <View style={styles.exportButtons}>
      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => handleExport('csv')}
      >
        <Text style={styles.exportButtonText}>CSV</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.exportButton, styles.exportButtonSecondary]}
        onPress={() => handleExport('json')}
      >
        <Text style={styles.exportButtonTextSecondary}>JSON</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => handleExport('pdf')}
      >
        <Text style={styles.exportButtonText}>PDF</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Chargement des rapports...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Text style={styles.errorText}>Erreur: {String(error)}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Moteur de Rapports Flexibles</Text>
      </View>

      {/* Éditeur de requête */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurer le Rapport</Text>
        {definitions && definitions.length > 0 ? (
          <QueryBuilderVisualEditor
            availableFields={[]}
            onQueryChange={handleQueryChange}
          />
        ) : (
          <Text style={styles.emptyText}>Aucun template de rapport disponible</Text>
        )}
      </View>

      {/* Aperçu des données */}
      {customQuery && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aperçu des Données (Prévisualisation)</Text>
          {/* Ici on afficherait les résultats de l'exécution de la requête */}
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewText}>Exécution de la requête configurable...</Text>
            <Text style={styles.previewTextSmall}>Le query builder connecté au backend retournera les données ici</Text>
          </View>
        </View>
      )}

      {/* Table Renderer (pour les données existantes) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tableau de Données</Text>
        {instances && instances.length > 0 ? (
          <ReportTableRenderer
            data={instances}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'period', label: 'Période' },
              { key: 'generatedAt', label: 'Généré le' },
              { key: 'status', label: 'Statut' },
            ]}
            isLoading={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun rapport généré pour le moment</Text>
          </View>
        )}
      </View>

      {/* Visualisation Graphique */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visualisation</Text>
        {instances && instances.length > 0 ? (
          <ChartRendererMobile
            data={instances[0].report}
            type="bar"
            config={{ title: 'Revenu par Catégorie' }}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune donnée disponible pour la visualisation</Text>
          </View>
        )}
      </View>

      {/* Actions d'export */}
      {instances && instances.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exporter</Text>
          {exportButtons()}
        </View>
      )}

      {/* Infos */}
      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Le Flexible Report Engine permet de créer n'importe quel rapport métier sans développer de nouveau module.
          {'\n'}Filtres, agrégations, présentations, exports — tout est configurable à la volée.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#6b7280', marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center' },
  retryText: { color: '#6366f1', marginTop: 10, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { padding: 8 },
  backButtonText: { color: '#6366f1', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  section: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  previewPlaceholder: { padding: 20, backgroundColor: '#f9fafb', borderRadius: 4, borderWidth: 1, borderColor: '#e5e7eb', minHeight: 100 },
  previewText: { color: '#6b7280', fontSize: 14 },
  previewTextSmall: { color: '#9ca3af', fontSize: 12, marginTop: 4 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  exportButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  exportButton: { flex: 1, minWidth: 100, paddingVertical: 12, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' },
  exportButtonSecondary: { backgroundColor: '#8b5cf6' },
  exportButtonText: { color: 'white', fontWeight: '600' },
  exportButtonTextSecondary: { color: 'white', fontWeight: '600' },
  infoSection: { padding: 16, backgroundColor: '#fffbeb', borderRadius: 8, marginBottom: 16 },
  infoText: { color: '#92400e', fontSize: 13, lineHeight: 18 },
});

export default ReportPage;
