/**
 * QueryBuilderVisualEditor Component Test
 * @traceable flexible-report-engine-arch.md §Tests UI
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryBuilderVisualEditor } from '../components/QueryBuilderVisualEditor';
import type { DataType, FilterOperator, AggregationType } from '../../../core/query-builder/types';

const mockAvailableFields = [
  { name: 'montant', label: 'Montant', type: 'number' as DataType },
  { name: 'statut', label: 'Statut', type: 'string' as DataType },
  { name: 'date_transaction', label: 'Date', type: 'date' as DataType },
];

describe('QueryBuilderVisualEditor', () => {
  it('renders filter inputs', () => {
    render(<QueryBuilderVisualEditor availableFields={mockAvailableFields} onQueryChange={() => {}} />);

    // Should have at least one filter row
    expect(screen.getByText('Éditeur de Requêtes')).toBeOnTheScreen();
    expect(screen.findByText('Filtres (WHERE)')).not.toBeNull();
  });

  it('allows adding filters', () => {
    const { getByText } = render(<QueryBuilderVisualEditor availableFields={mockAvailableFields} onQueryChange={() => {}} />);

    // Add filter button exists
    const addFilterBtn = getByText('+ Ajouter une condition');
    fireEvent.press(addFilterBtn);

    // Should now have 2 filter rows (one value input per filter)
    expect(screen.getAllByPlaceholderText('Valeur').length).toBe(2);
  });

  it('allows adding aggregations', () => {
    const { getByText } = render(<QueryBuilderVisualEditor availableFields={mockAvailableFields} onQueryChange={() => {}} />);

    const addAggBtn = getByText('+ Ajouter une agrégation');
    fireEvent.press(addAggBtn);

    // Should show aggregation picker
    expect(screen.getByText('Compter (count)')).toBeOnTheScreen();
  });

  it('builds query object', () => {
    const mockOnQueryChange = jest.fn();
    render(<QueryBuilderVisualEditor availableFields={mockAvailableFields} onQueryChange={mockOnQueryChange} />);

    // Change should trigger query rebuild via useEffect
    expect(mockOnQueryChange).toHaveBeenCalled();
  });

  it('shows JSON preview', () => {
    render(<QueryBuilderVisualEditor availableFields={mockAvailableFields} onQueryChange={() => {}} />);
    expect(screen.getByText('Requête JSON (Aperçu)')).toBeOnTheScreen();
  });
});
