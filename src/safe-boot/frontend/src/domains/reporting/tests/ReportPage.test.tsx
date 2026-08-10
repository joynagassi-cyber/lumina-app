/**
 * ReportPage Component Integration Test
 * Teste le flux complet de la page de rapports
 * @traceable flexible-report-engine-arch.md §Tests E2E Frontend
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import ReportPage from '../pages/ReportPage';
import { useReports } from '../hooks';

// Mock le hook useReports (shape du domain model actuel)
jest.mock('../hooks', () => ({
  useReports: jest.fn(),
}));

const mockedUseReports = useReports as jest.Mock;

const baseModel = {
  definitions: [
    {
      id: 'def-1',
      organizationId: 'org-123',
      code: 'custom',
      title: 'Rapport personnalisé',
      description: '',
      type: 'custom',
      defaultPeriod: 'monthly',
      isSystem: false,
      version: 1,
      synced: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  instances: [
    {
      report: {
        id: 'report-1',
        reportDefinitionId: 'def-1',
        organizationId: 'org-123',
        type: 'balance_sheet',
        period: 'monthly',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
        generatedAt: '2024-01-31T00:00:00.000Z',
        status: 'generated',
        generatedBy: 'user-1',
        expiresAt: null,
        version: 1,
        synced: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        data: { total_income: 1000 },
      },
      preview: 'Aperçu du rapport...',
    },
  ],
  totalCount: 1,
  selectedInstance: null,
  isLoading: false,
  error: null,
  loading: false,
};

describe('ReportPage', () => {
  const mockOrganizationId = 'org-123';

  beforeEach(() => {
    mockedUseReports.mockReturnValue({ ...baseModel });
  });

  it('render la page avec les composants principaux', async () => {
    render(<ReportPage organizationId={mockOrganizationId} />);

    // Vérifier le titre
    await waitFor(() => {
      expect(screen.getByText('Moteur de Rapports Flexibles')).toBeOnTheScreen();
    });

    // Vérifier l'éditeur de requête
    expect(screen.getByText('Éditeur de Requêtes')).toBeOnTheScreen();
    expect(screen.getByText('Configurer le Rapport')).toBeOnTheScreen();

    // Vérifier le tableau de données
    expect(screen.getByText('Tableau de Données')).toBeOnTheScreen();

    // Vérifier les boutons d'export
    expect(screen.getByText('CSV')).toBeOnTheScreen();
    expect(screen.getByText('JSON')).toBeOnTheScreen();
    expect(screen.getByText('PDF')).toBeOnTheScreen();

    // Vérifier les infos
    expect(screen.getByText(/Le Flexible Report Engine permet de créer n'importe quel rapport métier sans développer de nouveau module\./)).toBeOnTheScreen();
  });

  it("affiche l'état de chargement", () => {
    mockedUseReports.mockReturnValueOnce({
      ...baseModel,
      definitions: [],
      instances: [],
      totalCount: 0,
      isLoading: true,
      error: null,
      loading: true,
    });

    render(<ReportPage organizationId={mockOrganizationId} />);
    expect(screen.getByText('Chargement des rapports...')).toBeOnTheScreen();
  });

  it("affiche l'état d'erreur", () => {
    mockedUseReports.mockReturnValueOnce({
      ...baseModel,
      definitions: [],
      instances: [],
      totalCount: 0,
      isLoading: false,
      error: 'Erreur de connexion',
      loading: false,
    });

    render(<ReportPage organizationId={mockOrganizationId} />);
    expect(screen.getByText('Erreur: Erreur de connexion')).toBeOnTheScreen();
  });

  it('affiche une liste vide quand pas de rapports', () => {
    mockedUseReports.mockReturnValueOnce({
      ...baseModel,
      definitions: [],
      instances: [],
      totalCount: 0,
    });

    render(<ReportPage organizationId={mockOrganizationId} />);
    expect(screen.getByText('Aucun rapport généré pour le moment')).toBeOnTheScreen();
  });
});
