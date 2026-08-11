/**
 * ReportTableRenderer — Render tabulaire pour les rapports
 * @traceability flexible-report-engine-arch.md §Presentations
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { ReportGenerated } from '../types';

// Type pour les colonnes de tableau
export interface TableColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date';
  format?: string;
}

// Props du composant
interface ReportTableRendererProps {
  data: any[];           // Les données à afficher
  columns?: TableColumn[]; // Colonnes personnalisées (optionnel)
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
  style?: any;
}

// Détecter automatiquement les colonnes des données
function detectColumns(data: any[]): TableColumn[] {
  if (data.length === 0) return [];

  const columns: TableColumn[] = [];
  const firstRow = data[0];

  for (const key of Object.keys(firstRow)) {
    columns.push({
      key,
      label: key.replace(/([A-Z])/g, ' $1').trimStart().charAt(0).toUpperCase() + key.replace(/([A-Z])/g, ' $1').trimStart().slice(1),
      type: typeof firstRow[key] as 'string' | 'number' | 'date' | 'string',
    });
  }

  return columns;
}

// Format une valeur selon son type
function formatValue(value: any, type?: 'string' | 'number' | 'date'): string {
  if (value === null || value === undefined || value === '') return '';

  if (type === 'number') {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value));
  }

  if (type === 'date' && value instanceof Date) {
    return value.toLocaleDateString('fr-FR');
  }

  if (type === 'date' && typeof value === 'string') {
    const date = new Date(value);
    return date.toLocaleDateString('fr-FR');
  }

  return String(value);
}

// Composant Table Header
function TableHeader({ columns, onSort, sortConfig }: { columns: TableColumn[]; sortConfig?: { key: string; direction: 'asc' | 'desc' }; onSort?: (key: string) => void }) {
  return (
    <View style={styles.headerRow}>
      {columns.map((col) => (
        <TouchableOpacity
          key={col.key}
          style={[styles.headerCell, sortConfig?.key === col.key && styles.sortedHeader]}
          onPress={() => onSort && onSort(col.key)}
        >
          <Text style={styles.headerText}>
            {col.label}
            {sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Composant Table Row
function TableRow({ row, columns, style }: { row: any; columns: TableColumn[]; style?: any }) {
  return (
    <View style={[styles.row, style]}>
      {columns.map((col) => (
        <Text key={col.key} style={[styles.cell, styles.cellText]}>{formatValue(row[col.key], col.type)}</Text>
      ))}
    </View>
  );
}

// Composant Table Footer (avec pagination info)
function TableFooter({ totalCount, page, pageSize }: { totalCount: number; page: number; pageSize: number }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Affichage {(page - 1) * pageSize + 1} à {Math.min(page * pageSize, totalCount)} sur {totalCount} enregistrements
      </Text>
    </View>
  );
}

export function ReportTableRenderer({ data, columns, isLoading, error, onRefresh, style }: ReportTableRendererProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Détecter les colonnes si non fournies
  const tableColumns = useMemo(() => columns || detectColumns(data), [columns, data]);

  // Tri des données
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data];
    if (sortConfig) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        if (sortConfig.direction === 'asc') {
          return String(aVal).localeCompare(String(bVal), 'fr');
        } else {
          return String(bVal).localeCompare(String(aVal), 'fr');
        }
      });
    }
    return sorted;
  }, [data, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handle sort
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Revenir à la page 1 au tri
  };

  // Handle refresh
  const handleRefresh = () => {
    onRefresh && onRefresh();
    setCurrentPage(1);
    setSortConfig(null);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Text style={styles.errorText}>Erreur: {error}</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (pagedData.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyText}>Aucun résultat à afficher</Text>
        {onRefresh && (
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.refreshText}>Rafraîchir</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, style]}>
      <TableHeader columns={tableColumns} sortConfig={sortConfig ?? undefined} onSort={handleSort} />
      {pagedData.map((row, index) => (
        <TableRow key={index} row={row} columns={tableColumns} style={styles.row} />
      ))}
      {totalPages > 1 && <TableFooter totalCount={sortedData.length} page={currentPage} pageSize={pageSize} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerRow: { flexDirection: 'row', backgroundColor: '#6366f1', padding: 8 },
  headerCell: { flex: 1, padding: 4 },
  sortedHeader: { backgroundColor: '#4f46e5' },
  headerText: { color: 'white', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: 'white' },
  cell: { flex: 1, padding: 2 },
  cellText: { color: '#1f2937', fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#6b7280', marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center' },
  retryText: { color: '#6366f1', marginTop: 10, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#6b7280', fontSize: 16 },
  refreshText: { color: '#6366f1', marginTop: 10, fontWeight: '600' },
  footer: { padding: 8, backgroundColor: '#f3f4f6', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  footerText: { color: '#6b7280', fontSize: 11, textAlign: 'center' },
});

export default ReportTableRenderer;
