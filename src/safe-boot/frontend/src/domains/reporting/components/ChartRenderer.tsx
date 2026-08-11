/**
 * ChartRenderer - Composant graphique pour les rapports
 * Rendu natif (View/Text) sans dépendance externe : recharts exige react-dom
 * (web) et n'est pas utilisable dans React Native / Expo.
 * @traceable flexible-report-engine-arch.md §ChartRenderer
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { ReportGenerated } from '../types';

// Types de graphiques
export type ChartType = 'bar' | 'line' | 'pie' | 'horizontalBar';

// Prop du composant
interface ChartRendererProps {
  data: ReportGenerated; // Les données du rapport
  type: ChartType; // Type de graphique à afficher
  config?: {
    xKey?: string; // Clé pour l'axe X
    yKey?: string; // Clé pour l'axe Y
    colorScheme?: string[]; // Palette de couleurs
    title?: string; // Titre du graphique
  };
  style?: any;
}

// Couleurs par défaut
const DEFAULT_COLOR_SCHEME = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

interface ChartDatum {
  name: string;
  income: number;
  expense: number;
  net: number;
}

const FALLBACK_DATA: ChartDatum[] = [
  { name: 'Catégorie 1', income: 1000, expense: 500, net: 500 },
  { name: 'Catégorie 2', income: 800, expense: 600, net: 200 },
];

/** Extrait les séries depuis report.data (Record<string, {income, expense}>), sinon démo. */
function extractChartData(data: ReportGenerated): ChartDatum[] {
  const raw = data?.data as Record<string, { income?: number; expense?: number }> | undefined;
  if (raw && Object.keys(raw).length > 0) {
    return Object.entries(raw).map(([cat, values]) => ({
      name: cat,
      income: typeof values?.income === 'number' ? values.income : 0,
      expense: typeof values?.expense === 'number' ? values.expense : 0,
      net: (typeof values?.income === 'number' ? values.income : 0) - (typeof values?.expense === 'number' ? values.expense : 0),
    }));
  }
  return FALLBACK_DATA;
}

export function ChartRenderer({ data, type, config = {}, style }: ChartRendererProps) {
  const { colorScheme = DEFAULT_COLOR_SCHEME, title = 'Graphique' } = config;
  const chartData = extractChartData(data);
  const maxValue = Math.max(1, ...chartData.map((d) => Math.max(d.income, d.expense)));

  const renderBar = () => (
    <View style={styles.chartArea}>
      {chartData.map((d, index) => (
        <View key={d.name} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>
            {d.name}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${(d.income / maxValue) * 100}%`, backgroundColor: colorScheme[index % colorScheme.length] },
              ]}
            />
          </View>
          <Text style={styles.barValue}>{d.income}</Text>
        </View>
      ))}
    </View>
  );

  const renderLine = () => (
    <View style={styles.chartArea}>
      {chartData.map((d, index) => (
        <View key={d.name} style={styles.lineRow}>
          <View style={[styles.lineDot, { backgroundColor: colorScheme[index % colorScheme.length] }]} />
          <Text style={styles.lineLabel} numberOfLines={1}>
            {d.name}
          </Text>
          <Text style={styles.lineValue}>revenus {d.income} · dépenses {d.expense}</Text>
        </View>
      ))}
    </View>
  );

  const renderPie = () => {
    const total = chartData.reduce((sum, d) => sum + d.net, 0) || 1;
    return (
      <View style={styles.chartArea}>
        {chartData.map((d, index) => (
          <View key={d.name} style={styles.pieRow}>
            <View style={[styles.pieSwatch, { backgroundColor: colorScheme[index % colorScheme.length] }]} />
            <Text style={styles.pieLabel} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={styles.pieValue}>{Math.round((d.net / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    );
  };

  // Identique à bar (axes inversés) — rendu natif sans librairie.
  const renderHorizontalBar = renderBar;

  const renderCharts: Record<string, () => React.ReactElement> = {
    bar: renderBar,
    line: renderLine,
    pie: renderPie,
    horizontalBar: renderHorizontalBar,
  };

  const ChartComponent = renderCharts[type] || renderBar;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title || 'Visualisation de Données'}</Text>
      <ScrollView style={styles.chartContainer}>
        <ChartComponent />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: 'white', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  chartContainer: { flex: 1, height: 300 },
  chartArea: { gap: 10, paddingVertical: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 100, fontSize: 12, color: '#374151' },
  barTrack: { flex: 1, height: 16, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 48, textAlign: 'right', fontSize: 12, color: '#6b7280' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineDot: { width: 10, height: 10, borderRadius: 5 },
  lineLabel: { width: 100, fontSize: 12, color: '#374151' },
  lineValue: { flex: 1, fontSize: 12, color: '#6b7280' },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieSwatch: { width: 12, height: 12, borderRadius: 2 },
  pieLabel: { flex: 1, fontSize: 12, color: '#374151' },
  pieValue: { fontSize: 12, fontWeight: '600', color: '#374151' },
});

export default ChartRenderer;
