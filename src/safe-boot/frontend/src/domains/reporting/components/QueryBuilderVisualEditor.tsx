/**
 * QueryBuilderVisualEditor — Éditeur visuel de requêtes pour le Flexible Report Engine
 * @traceability QUERY-BUILDER-SPEC-V1.md §UI
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SelectField } from '@/components/ui';
import type { DataType, FilterOperator, AggregationType } from '../../../core/query-builder/types';

// Type pour une condition de filtre
interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string;
}

// Type pour une agrégation
interface AggregationItem {
  type: AggregationType;
  field: string | null;
  alias: string;
}

// Props du composant
interface QueryBuilderVisualEditorProps {
  availableFields: Array<{ name: string; type: DataType; label: string }>;
  onQueryChange: (query: any) => void;
  style?: any;
}

export function QueryBuilderVisualEditor({ availableFields, onQueryChange, style }: QueryBuilderVisualEditorProps) {
  const [filters, setFilters] = useState<FilterCondition[]>([{ field: availableFields[0]?.name || '', operator: 'eq', value: '' }]);
  const [aggregations, setAggregations] = useState<AggregationItem[]>([]);
  const [orderByField, setOrderByField] = useState<string | null>(null);
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<string | string>('');

  // Ajouter une nouvelle condition de filtre
  const addFilter = () => {
    setFilters([...filters, { field: availableFields[0]?.name || '', operator: 'eq', value: '' }]);
  };

  // Supprimer une condition de filtre
  const removeFilter = (index: number) => {
    if (filters.length > 1) {
      setFilters(filters.filter((_, i) => i !== index));
    } else {
      Alert.alert('Attention', 'Vous devez avoir au moins une condition de filtre');
    }
  };

  // Mettre à jour une condition de filtre
  const updateFilter = (index: number, field: string, operator: string, value: string) => {
    setFilters(filters.map((f, i) => i === index ? { field, operator: operator as FilterOperator, value } : f));
  };

  // Ajouter une agrégation
  const addAggregation = () => {
    if (aggregations.length >= 5) {
      Alert.alert('Limite atteinte', 'Maximum 5 agrégations autorisées');
      return;
    }
    setAggregations([...aggregations, { type: 'count', field: null, alias: '' }]);
  };

  // Supprimer une agrégation
  const removeAggregation = (index: number) => {
    setAggregations(aggregations.filter((_, i) => i !== index));
  };

  // Mettre à jour une agrégation
  const updateAggregation = (index: number, type: AggregationType, field: string, alias: string) => {
    setAggregations(aggregations.map((agg, i) => i === index ? { type, field: field || null, alias } : agg));
  };

  // Construire l'objet query
  const buildQuery = () => {
    const query: any = {
      from: { table: 'transactions', alias: 't' }, // Source par défaut (à rendre configurable)
      where: filters.length > 0 ? { type: 'and', children: filters.map(f => ({ type: 'field', field: f.field, operator: f.operator, value: f.value })) } : null,
      groupBy: [],
      orderBy: orderByField ? [{ field: orderByField, direction: orderDirection }] : [],
      limit: limit ? Number(limit) : undefined,
      aggregations: aggregations.map(a => ({ type: a.type, field: a.field, alias: a.alias || a.type })),
    };

    onQueryChange(query);
    return query;
  };

  // Émettre les changements en temps réel
  React.useEffect(() => {
    buildQuery();
  }, [filters, aggregations, orderByField, orderDirection, limit, onQueryChange]);

  // Populate les options du select pour les champs
  const fieldOptions = availableFields.map(f => ({ value: f.name, label: f.label }));

  return (
    <ScrollView style={[styles.container, style]}>
      <Text style={styles.title}>Éditeur de Requêtes</Text>

      {/* Filtres */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filtres (WHERE)</Text>
        {filters.map((filter, index) => (
          <View key={index} style={styles.filterRow}>
            <SelectField
              value={filter.field}
              placeholder="Champ"
              options={fieldOptions}
              onChange={(v) => updateFilter(index, v, filter.operator, filter.value)}
            />
            <SelectField
              value={filter.operator}
              options={[
                { value: 'eq', label: 'égal (eq)' },
                { value: 'neq', label: 'différent (neq)' },
                { value: 'gt', label: 'supérieur (gt)' },
                { value: 'gte', label: 'supérieur ou égal (gte)' },
                { value: 'lt', label: 'inférieur (lt)' },
                { value: 'lte', label: 'inférieur ou égal (lte)' },
              ]}
              onChange={(v) => updateFilter(index, filter.field, v as FilterOperator, filter.value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Valeur"
              value={filter.value}
              onChangeText={(v) => updateFilter(index, filter.field, filter.operator, v)}
            />
            {filters.length > 1 && (
              <TouchableOpacity onPress={() => removeFilter(index)}>
                <Text style={styles.removeButton}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={addFilter} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Ajouter une condition</Text>
        </TouchableOpacity>
      </View>

      {/* Agrégations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agrégations</Text>
        {aggregations.length === 0 && (
          <Text style={styles.emptyText}>Aucune agrégation ajoutée</Text>
        )}
        {aggregations.map((agg, index) => (
          <View key={index} style={styles.aggregationRow}>
            <SelectField
              value={agg.type}
              options={[
                { value: 'count', label: 'Compter (count)' },
                { value: 'sum', label: 'Somme (sum)' },
                { value: 'avg', label: 'Moyenne (avg)' },
                { value: 'min', label: 'Minimum (min)' },
                { value: 'max', label: 'Maximum (max)' },
                { value: 'percentage', label: 'Pourcentage (percentage)' },
                { value: 'distinct', label: 'Distinct (distinct)' },
              ]}
              onChange={(v) => updateAggregation(index, v as AggregationType, agg.field ?? '', agg.alias)}
            />
            <SelectField
              value={agg.field || ''}
              placeholder="Champ (pour la plupart des agrégations)"
              options={fieldOptions}
              onChange={(v) => updateAggregation(index, agg.type, v, agg.alias)}
            />
            <TextInput
              style={styles.input}
              placeholder="Alias"
              value={agg.alias}
              onChangeText={(v) => updateAggregation(index, agg.type, agg.field ?? '', v)}
            />
            {aggregations.length > 1 && (
              <TouchableOpacity onPress={() => removeAggregation(index)}>
                <Text style={styles.removeButton}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={addAggregation} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Ajouter une agrégation</Text>
        </TouchableOpacity>
      </View>

      {/* Ordre et Limite */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tri & Pagination</Text>
        <View style={styles.tripRow}>
          <Text style={styles.label}>Trier par:</Text>
          <SelectField
            value={orderByField || ''}
            placeholder="Aucun tri"
            options={[{ value: '', label: 'Aucun tri' }, ...fieldOptions]}
            onChange={setOrderByField}
          />
          <SelectField
            value={orderDirection}
            options={[
              { value: 'asc', label: 'Croissant (asc)' },
              { value: 'desc', label: 'Décroissant (desc)' },
            ]}
            onChange={(v) => setOrderDirection(v as 'asc' | 'desc')}
          />
        </View>
        <View style={styles.limitRow}>
          <Text style={styles.label}>Limite:</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre d'enregistrements"
            value={limit}
            onChangeText={setLimit}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Résultat de la requête (pour debugging) */}
      <View style={[styles.section, styles.debugSection]}>
        <Text style={styles.sectionTitle}>Requête JSON (Aperçu)</Text>
        <Text style={styles.debugText}>
          {/* Affichage simplifié du query builded */}
          {JSON.stringify({
            from: 'transactions',
            where: filters.length > 0 ? `${filters.length} condition(s)` : 'Aucun',
            aggregations: `${aggregations.length} agrégation(s)`,
            orderBy: orderByField ? `${orderByField} ${orderDirection}` : 'Aucun',
            limit: limit || 'Aucune',
          }, null, 2)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 20 },
  section: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  picker: { flex: 1, height: 40 },
  input: { flex: 1, height: 40, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8 },
  addButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16 },
  addButtonText: { color: '#6366f1', fontWeight: '600' },
  aggregationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4, flexWrap: 'wrap' },
  aggPicker: { flex: 0.8, height: 40 },
  removeButton: { color: '#ef4444', marginLeft: 8, fontWeight: '600' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  label: { minWidth: 80, color: '#374151', fontSize: 14 },
  emptyText: { color: '#6b7280', fontStyle: 'italic', padding: 8 },
  debugSection: { backgroundColor: '#f3f4f6' },
  debugText: { fontFamily: 'monospace', fontSize: 12, color: '#374151', backgroundColor: 'white', padding: 8, borderRadius: 4, maxHeight: 150, overflow: 'scroll' },
});

export default QueryBuilderVisualEditor;
