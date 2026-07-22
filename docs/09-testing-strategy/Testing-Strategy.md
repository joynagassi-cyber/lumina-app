# Testing Strategy — Protocol de Tests par Module

**Doc ID:** DOC-TESTING  
**Version:** 2.0  
**Statut :** SPÉCIFICATION OPÉRATIONNELLE  
**Dépendances :** 07-database-schema/, 04-business-rules/, 99-supporting/invariants.md, ADR-003

---

## 1. Matrice de Couverture Requise

| Module | Unit Tests | Component Tests | Integration Tests | E2E Flows |
|---|---|---|---|---|
| **Finance** | >95% | Chaque écran | Flow complet (create→approve) | Bilan calculation |
| **Auth** | >90% | LoginForm, Guard | Login + org selection | Full auth flow |
| **Sync** | >90% | N/A | Offline→Online transition | Multi-device conflict |
| **Members** | >80% | MemberCard, List | CRUD + search | Import/export CSV |
| **Groups** | >80% | GroupCard, Config | Feature toggle test | Create group + assign features |
| **Events** | >70% | EventCard | Calendar navigation | Recurring event creation |
| **Celeb** | >70% | CelebrationForm | Service scheduling | Sacrament tracking |
| **Dashboard** | >60% | Chart components | Data fetch mock | KPI generation |
| **Social** | >70% | PostCard | Feed rendering | Cross-org visibility |
| **Settings** | >80% | SettingRow | Preference save | Language/theme change |

---

## 2. Regles Par Type de Test

### 2.1 Unit Tests ( Jest + React Native Testing Library )

**Couche cible :** Services, Validators, Adapters, Helpers

Chaque test doit suivre le pattern AAA (Arrange-Act-Assert) :

```typescript
describe('TransactionService', () => {
  test('should prevent approval of non-pending transaction', async () => {
    // Arrange
    const tx = buildTransaction({ status: 'approved' });
    
    // Act
    const result = await service.approve(tx.id, userId);
    
    // Assert
    expect(result).toBe(false);
    await expect(db.get('transactions').find(tx.id)).toNotBeApproved();
  });
});
```

Règles spécifiques :
- **Finance tests** : tester TOUS les status transitions valides (draft→pending→approved, draft→rejected)
- **Offline tests** : tester la création en mode offline (pas de réseau) puis sync
- **Conflict tests** : simuler la même entité modifiée localement et sur le serveur

### 2.2 Component Tests

**Couche cible :** Tous les composants UI publics (exposés par `export`)

Chaque composant doit être testé dans ses états principaux :
- loading state
- empty state
- error state
- success state
- disabled/readonly state
- i18n FR + EN state

```typescript
describe('TransactionList', () => {
  test('shows loading skeleton while fetching', () => {
    render(<TransactionList />);
    expect(screen.getByTestId('skeleton-loader')).toBeTruthy();
  });
  
  test('renders empty state when no transactions', () => {
    render(<TransactionList transactions={[]} />);
    expect(screen.getByText('Aucune transaction')).toBeTruthy();
  });
});
```

### 2.3 Integration Tests

**Couche cible :** Flow complet d'une feature

Teste le parcours utilisateur de bout en bout avec mock DB et network :

```typescript
describe('Full Finance Flow', () => {
  test('can create → approve → calculate bilan transaction', async () => {
    // 1. Create draft transaction
    const id = await service.create({ amount: 1000, type: 'income', ... });
    
    // 2. Transition to pending
    expect(await service.statusChange(id, 'pending')).toBe(true);
    
    // 3. Approve (simulates admin action)
    expect(await service.approve(id, adminId)).toBe(true);
    
    // 4. Verify invariant: approved transaction cannot be modified
    expect(await service.update(id, { amount: 9999 })).toBe(false);
    
    // 5. Calculate bilan includes this transaction
    const bilan = await service.getBilan(2026);
    expect(bilan.income).toContain(1000);
  });
});
```

### 2.4 E2E Flows (Test Browser/App)

**Couche cible :** Parcours utilisateur réel (avec vrai InsForge local ou test backend)

Flows documentés dans `tests/flows/` :

```
tests/flows/
├── auth_flow_test.ts           # Login → org selection → dashboard
├── finance_flow_test.ts        # Dashboard → create transaction → approve
├── member_flow_test.ts         # Members → add → edit → delete
├── offline_sync_flow_test.ts   # Create offline → go online → verify sync
└── rbac_flow_test.ts           # Role transitions, permission checks
```

---

## 3. Invariant Testing Rules

Chaque invariant (INV-001 à INV-010) a des tests automatiques obligatoires :

| Invariant | Comment tester | Nombre min. de tests |
|---|---|---|
| INV-001 Immutabilité | Tenter de modifier une transaction approved | 3 (update, delete, bulk) |
| INV-002 Core/Business | Linter scanne le code pour `if (type === 'church')` | 1 (lint test) |
| INV-003 Offline | Créer transaction sans réseau, vérifier DB locale | 2 |
| INV-004 Multi-tenant | Deux orgs créent mêmes données, vérifier isolation | 3 (per table) |
| INV-005 Manifest | Parser manifest → vérifier engine interprète, pas code dur | 1 (integration) |
| INV-006 Vocabulary | Vérifier que toutes les enums viennent du vocab engine | 2 (scan tests) |
| INV-007 Audit | Loguer une action, vérifier immutabilité du log | 2 |
| INV-008 Double validation | Envoyer donnée invalide client→server, vérifier rejection | 2 |
| INV-009 JSON→Forms | Linter scanne JSX direct de formulaires | 1 (lint test) |
| INV-010 Versioning | Modifier champ versionné, vérifier ancienne version conservée | 2 |

---

## 4. CI/CD Pipeline Requirements

```yaml
stages:
  - lint: eslint + prettier + tsc --noEmit
  - unit: jest --coverage (finance threshold: 95%, others: 70%)
  - component: jest --testMatch "**/*.test.tsx"
  - integration: jest --runInBand (sequencial, shared DB)
  - e2e: playwright/capacitor test suite
  - build: expo prebuild (iOS + Android)
  - deploy-preview: if main branch
  - deploy-prod: only with manual approval tag
```

**Blocking rules (NB-RULE-09) :**
- Si coverage < seuil → BUILD FAIL
- Si lint error → BUILD FAIL
- Si tests unit échouent → BUILD FAIL
- Si invariant test échoue → BLOCK DEPLOY (même si lint/tests passent)
