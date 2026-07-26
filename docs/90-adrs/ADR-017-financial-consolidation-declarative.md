# ADR-017: Système de Consolidation Financière Multi-Niveaux Déclaratif

**Date:** 2026-07-24
**Statut:** PROPOSITION
**Décideurs:** CTO + Architecte Principal + Product Owner
**Conséquences:** Le bilan financier multi-niveaux est entièrement résolu par configuration manifest + moteur de consolidation runtime, jamais par code dur.

---

## 1. Analyse du Problème

L'architecture existante (ADR-014, Database-Schema, Organization-Graph-Spec) modélise les groupes via `org_units.parent_unit_id` et les transactions avec `org_id`. Mais **aucun mécanisme n'existe pour calculer un bilan à différents niveaux de la hiérarchie**. La tentative précédente de coder ça en dur a échoué car:

- Les transactions n'ont pas de champ `scope` (org-level vs group-level)
- Les départements (`departments`) n'ont pas de hiérarchie récursive explicite dans le manifest
- Le `calculateBilan()` dans `Database-Schema.md` agrège TOUTES les transactions d'une org sans distinction de scope
- Ajouter un nouveau groupe nécessite de modifier le code TypeScript, pas juste le manifest

**Ce document propose une solution entièrement déclarative exploitant les 5 capacités des Platform Capabilities.**

---

## 2. Modélisation des Données

### 2.1 Schéma PostgreSQL — Tables Étendues

La table `transactions` actuelle n'a pas de notion de scope groupe. On ajoute exactement 2 colonnes:

```sql
-- Extension de la table transactions existante
ALTER TABLE transactions
    ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'org'
        CHECK (scope_type IN ('org', 'group')),
    ADD COLUMN scope_target UUID REFERENCES org_units(id) ON DELETE SET NULL;

-- Index composite CRITIQUE pour les requêtes de consolidation
CREATE INDEX idx_transactions_scope ON transactions(org_id, scope_type, scope_target, transaction_date, status);
```

**Sémantique:**
| `scope_type` | `scope_target` | Signification |
|---|---|---|
| `'org'` | NULL | Transaction sur la caisse principale de l'organisation |
| `'group'` | UUID d'un org_unit | Transaction sur la caisse d'un groupe spécifique |

### 2.2 Schema WatermelonDB — Modèle Transaction Étendu

```typescript
@Table('transactions')
export class Transaction extends Model {
  id            = prop()
  _synced       = column('synced', 0)
  createdAt     = column('created_at')
  updatedAt     = column('updated_at')

  orgId         = column('org_id')
  type          = column('type')           // 'income' | 'expense' | 'transfer'
  amount        = column('amount')
  currency      = column('currency')
  categoryId    = column('category_id')
  description   = column('description')
  receiptPath   = column('receipt_path')
  date          = column('transaction_date')
  status        = column('status')
  createdBy     = column('created_by')
  approvedBy    = column('approved_by')
  approvedAt    = column('approved_at')
  version       = column('version', 1)

  // === NOUVEAUX CHAMPS SCOPE ===
  scopeType     = column('scope_type', 'org')  // 'org' | 'group'
  scopeTarget   = column('scope_target', null)  // org_unit_id si scope='group'
}
```

### 2.3 Schema Org_Unit (Hiérarchie Récursive)

Le modèle `OrgUnit` existe déjà dans Organization-Graph-Spec (§8). Il supporte nativement la récursion via `parent_unit_id`:

```sql
CREATE TABLE org_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_unit_id UUID REFERENCES org_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL DEFAULT 'department',  -- department | ministry | committee | sub_group
    description TEXT,
    has_financial_scope BOOLEAN NOT NULL DEFAULT false,  -- Ce groupe a-t-il SA propre caisse?
    financial_scope_id TEXT,  -- Identifiant du scope pour le manifest (ex: 'chorale', 'jeunesse')
    status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour traversée rapide de la hiérarchie
CREATE INDEX idx_org_units_parent ON org_units(org_id, parent_unit_id);
CREATE INDEX idx_org_units_type ON org_units(org_id, unit_type);
CREATE INDEX idx_org_units_has_finance ON org_units(org_id, has_financial_scope);
```

**`has_financial_scope`** est la clé: un org_unit sans ce flag est purement organisationnel (pas de caisse dédiée). Un org_unit avec `has_financial_scope=true` peut recevoir des transactions.

---

## 3. Calcul du Bilan — Logique Runtime

### 3.1 API du Consolidation Engine

```typescript
interface FinancialConsolidator {
  /**
   * Calcule le bilan pour un scope donné.
   * @param scope - 'org' (caisse principale uniquement), 'group:<unit_id>', ou 'all' (consolidé inclusif)
   * @param periodStart / periodEnd - Fenêtre temporelle
   * @returns Bilan structuré avec agrégation par catégorie
   */
  calculateBalance(
    scope: BalanceScope,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<BalanceReport>;

  /**
   * Retourne tous les enfants directs d'un org_unit.
   * Résolu depuis la base de données + manifest pour inclure les métadonnées financières.
   */
  getChildrenGroups(unitId: string): Promise<OrgUnitNode[]>;

  /**
   * Retourne TOUS les descendants récursifs (DFS).
   * Utilisé pour la consolidation niveau X complète.
   */
  getAllDescendantGroups(unitId: string): Promise<OrgUnitNode[]>;

  /**
   * Résout une chaîne de scope en un ensemble concret d'org_unit_ids.
   * Ex: 'group:chorale' → ['chorale-id']
   * Ex: 'all' pour org X → [X, chorale-id, jeunesse-id, soprano-id, ...]
   */
  resolveScope(scope: BalanceScope, orgId: string): Promise<string[]>;
}

type BalanceScope =
  | 'org'                // Caisse principale uniquement
  | `group:${string}`    // Groupe spécifique, ex: 'group:chorale'
  | 'all'                // Consolidé inclusif (org + TOUS descendants)
```

### 3.2 Implémentation Runtime

```typescript
async function calculateBalance(
  scope: BalanceScope,
  periodStart: Date,
  periodEnd: Date,
  db: Database,
  config: CompiledRuntimeConfig,
): Promise<BalanceReport> {
  // Étape 1: Résoudre le scope en liste d'org_unit_ids
  const targetUnitIds = await resolveScope(config, scope);

  // Étape 2: Construire la requête WatermelonDB dynamique
  const queryBuilder = db.get('transactions').query(
    Q.where('org_id', config.organization.id),
    Q.where('status', 'approved'),
    Q.where('transaction_date', '>=', periodStart.toISOString().slice(0, 10)),
    Q.where('transaction_date', '<=', periodEnd.toISOString().slice(0, 10)),
  );

  // Filtre scope: si scope='org', exclure les transactions group
  if (scope === 'org') {
    queryBuilder.prepareWhereClause(Q.where('scope_type', 'org'));
  } else {
    // 'group:X' ou 'all': inclure transactions scopes correspondantes
    const unitIdsStr = targetUnitIds.map(String);
    queryBuilder.prepareWhereClause(
      Q.or(
        Q.where('scope_type', 'org'),
        Q.where('scope_target', unitIdsStr),
      )
    );
  }

  // Exclure les transferts internes pour éviter le double comptage
  const transactions = await queryBuilder.fetch();
  const netTransfers = transactions
    .filter(t => t.type === 'transfer')
    .reduce((sum, t) => sum + t.amount, 0);

  // Étape 3: Agréger par catégorie
  const categories = config.vocabulary?.finance?.categories || [];
  const byCategory: Record<string, { income: number; expense: number }> = {};
  let totalIncome = 0;
  let totalExpense = 0;

  for (const txn of transactions) {
    if (txn.type === 'transfer') continue; // Ignoré pour le bilan

    const cat = txn.categoryId;
    if (!byCategory[cat]) {
      byCategory[cat] = { income: 0, expense: 0 };
    }
    if (txn.type === 'income') {
      byCategory[cat].income += txn.amount;
      totalIncome += txn.amount;
    } else {
      byCategory[cat].expense += txn.amount;
      totalExpense += txn.amount;
    }
  }

  return {
    scope,
    period: { start: periodStart, end: periodEnd },
    totals: {
      income: totalIncome,
      expense: totalExpense,
      netResult: totalIncome - totalExpense,
      transfers: netTransfers,
    },
    byCategory,
    transactionCount: transactions.length,
  };
}
```

### 3.3 Traversée de Hiérarchie (DFS)

```typescript
/**
 * DFS récursif sur org_units. Limité à maxDepth = 5 (contrat manifest R-02).
 * Runtime: interroge org_units WHERE org_id=? AND parent_unit_id IN (...).
 */
async function getAllDescendantGroups(
  rootUnitId: string,
  maxDepth: number = 5,
): Promise<OrgUnitNode[]> {
  const results: OrgUnitNode[] = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: rootUnitId, depth: 0 }];

  while (queue.length > 0 && results.length < 1000) { // safety cap
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const children = await db.get('org_units').query(
      Q.where('parent_unit_id', current.id),
      Q.where('status', 'active'),
    ).fetch();

    for (const child of children) {
      results.push({ id: child.id, name: child.name, depth: current.depth + 1 });
      queue.push({ id: child.id, depth: current.depth + 1 });
    }
  }

  return results;
}
```

---

## 4. Template YAML Complet du Système Financier

```yaml
# manifests/financial-system.yaml
# Ce fichier configure TOUT le comportement financier — zéro code dur.

finance:
  # === CATÉGORIES DE TRANSACTIONS ===
  # Résolues depuis Vocabulary Engine + enrichies de métadonnées de rendu
  categories:
    income:
      - key: "tithes"
        label: "Dîmes"
        color: "#4CAF50"
        reports_as: "main_income"
      - key: "offerings"
        label: "Offrandes"
        color: "#FF9800"
        reports_as: "main_income"
      - key: "donations"
        label: "Dons"
        color: "#8BC34A"
        reports_as: "other_income"
      - key: "fundraising"
        label: "Collecte de fonds"
        color: "#2196F3"
        reports_as: "other_income"
      - key: "membership_fees"
        label: "Cotisations"
        color: "#00BCD4"
        reports_as: "other_income"

    expense:
      - key: "ministry_expenses"
        label: "Dépenses ministérielles"
        color: "#F44336"
        reports_as: "ministry"
      - key: "maintenance"
        label: "Maintenance"
        color: "#FF5722"
        reports_as: "operations"
      - key: "events_expenses"
        label: "Événements"
        color: "#E91E63"
        reports_as: "events"
      - key: "admin_expenses"
        label: "Frais administratifs"
        color: "#9C27B0"
        reports_as: "operations"
      - key: "project_expenses"
        label: "Projets spéciaux"
        color: "#673AB7"
        reports_as: "projects"

  # === RÈGLES DE CONSOLIDATION ===
  # Déclare QUOI inclure dans chaque type de bilan — entièrement configurable
  consolidation_rules:
    # Bilan Group: uniquement le groupe spécifique
    group_only:
      description: "Bilan d'un groupe spécifique — uniquement ses transactions"
      include_scopes: ["group:${unit_id}"]
      exclude_scopes: ["*"]
      show_transfers: false

    # Bilan Org: uniquement la caisse principale de l'organisation
    org_only:
      description: "Bilan de l'organisation (caisse mère) — SANS les groupes"
      include_scopes: ["org"]
      exclude_scopes: ["group:*"]
      show_transfers: false

    # Bilan Consolidé: INCLUSIF — org + TOUS les groupes
    consolidated:
      description: "Bilan consolidé — org + tous les groupes descendants"
      include_scopes: ["org", "group:*all_descendants*"]
      exclude_scopes: []
      show_transfers: true
      # Supprime les transferts internes parent<->enfant pour éviter double comptage
      net_internal_transfers: true

    # Bilan Niveau N: org + un sous-ensemble de descendants
    partial_consolidation:
      description: "Bilan partiel — org + certains descendants seulement"
      include_scopes:
        - "org"
        - "group:${included_unit_ids}"
      exclude_scopes: []
      show_transfers: false

  # === SEUILS D'APPROBATION PAR NIVEAU ===
  approval_thresholds:
    default:
      auto_approve_max: 100        # < ce montant = auto-approbation
      treasurer_approval: 1000     # ≤ ce montant = trésorier
      pastor_approval: 5000        # ≤ ce montant = pasteur + trésorier
      board_approval: null         # au-dessus = approbation conseil
    per_group_override:
      # Chaque groupe peut avoir SES propres seuils (override partiel)
      # Résolu via deepMerge du manifest parent → enfant
      chorale:
        auto_approve_max: 50
        treasurer_approval: 500
        pastor_approval: 2000

  # === PERMISSIONS FINANCIÈRES PAR RÔLE ===
  permissions:
    admin:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:bilan:write"
      - "finance:rapport:read"
      - "finance:rapport:write"
      - "finance:consolidation:*"
      - "finance:approval:*"

    treasurer:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:bilan:write"
      - "finance:rapport:read"
      - "finance:rapport:write"
      - "finance:consolidation:group_own"    # Peut consolider UNIQ. ses groupes
      - "finance:approval:treasurer"

    pastor:
      - "finance:bilan:read"
      - "finance:rapport:read"
      - "finance:consolidation:read"          # Lecture consolidation uniquement
      - "finance:approval:pastor"

    staff:
      - "finance:rapport:read"               # Lecture rapports uniquement

  # === TYPES DE BILAN DISPONIBLES ===
  # Déclare quels rapports de bilan l'UI doit afficher — résolution dynamique
  report_types:
    - id: "group_balance"
      label: "Bilan du Groupe"
      scope_template: "group:${unit_id}"
      form: "bilan_report_template"
      permissions_required: ["finance:bilan:read"]
      export_formats: ["pdf", "csv"]

    - id: "org_balance"
      label: "Bilan de l'Organisation"
      scope_template: "org"
      form: "bilan_report_template"
      permissions_required: ["finance:bilan:read"]
      export_formats: ["pdf", "csv"]

    - id: "consolidated_balance"
      label: "Bilan Consolidé"
      scope_template: "all"
      form: "bilan_report_template"
      permissions_required: ["finance:consolidation:read"]
      export_formats: ["pdf", "csv"]

    - id: "partial_consolidation"
      label: "Bilan Partiel"
      scope_template: "partial"
      form: "bilan_partial_report_template"
      permissions_required: ["finance:consolidation:read"]
      export_formats: ["pdf", "csv"]

  # === EXPORT ===
  export:
    pdf:
      template: "financial_report.pdf.hbs"
      header_logo: "settings.org_logo_url"
      include_transaction_list: true
      include_category_breakdown: true
      include_trend_chart: true
    csv:
      delimiter: ";"
      include_headers: true
      date_format: "YYYY-MM-DD"
```

---

## 5. Architecture Runtime Complète — Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FINANCIAL BALANCE PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Charger le Manifest                                        │
│  ───────────────────────────────────────────────────────────────    │
│  ManifestEngine.loadManifest(orgId)                                 │
│    → CompiledRuntimeConfig (cache LRU)                              │
│    → finance.consolidation_rules chargés                            │
│    → finance.report_types déclarés                                  │
│    → finance.categories reliées au Vocabulary Engine                │
│                                                                     │
│  Step 2: Résoudre la hiérarchie des groupes                         │
│  ───────────────────────────────────────────────────────────────    │
│  FinancialConsolidator.resolveScope(scope, orgId)                   │
│    → Queries org_units avec CTE récursive PostgreSQL:               │
│       WITH RECURSIVE descendants AS (                               │
│         SELECT id FROM org_units WHERE id = $1                      │
│         UNION ALL                                                   │
│         SELECT ou.id FROM org_units ou                             │
│           JOIN descendants d ON ou.parent_unit_id = d.id            │
│       ) SELECT id FROM descendants;                                 │
│    → Runtime: getAllDescendantGroups(rootId) → DFS tree             │
│    → Cache résultat dans WatermelonDB local                         │
│                                                                     │
│  Step 3: Scanner les transactions par scope                         │
│  ───────────────────────────────────────────────────────────────    │
│  WatermelonDB query (offline):                                      │
│    transactions                                                   ║   │
│      WHERE org_id = ?                                              ║   │
│        AND status = 'approved'                                     ║   │
│        AND scope_type IN (résolu depuis rule)                       ║   │
│        AND transaction_date BETWEEN ? AND ?                         ║   │
│    → Index(idx_transactions_scope) exploité automatiquement         │
│    → Transactions synced=1 uniquement (hors-ligne safe)             │
│                                                                     │
│  Step 4: Agréger par catégorie                                      │
│  ───────────────────────────────────────────────────────────────    │
│  Pour chaque transaction approved:                                  │
│    category = lookup(vocab:finance/categories, txn.category_id)     │
│    byCategory[category.key].income += amount  (si type='income')    │
│    byCategory[category.key].expense += amount (si type='expense')   │
│    totalIncome += amount                                            │
│    totalExpense += amount                                           │
│    → O(n) linéaire sur transactions approuvées                      │
│                                                                     │
│  Step 5: Appliquer les règles de consolidation                      │
│  ───────────────────────────────────────────────────────────────    │
│  rule = consolidation_rules[scope_template_mapping]                 │
│    → group_only, org_only, consolidated, ou partial_consolidation   │
│  Si rule.net_internal_transfers:                                   │
│    filtrer les transferts org↔descendants (double comptage)         │
│  Si rule.show_transfers:                                          ║   │
│    inclure les transferts dans le rapport mais marquer distinct     │
│                                                                     │
│  Step 6: Générer le bilan (Forms Engine — read-only)               │
│  ───────────────────────────────────────────────────────────────    │
│  FormsEngine.renderForm("bilan_report_template", data)              │
│    → Section "Période": start_date, end_date                        │
│    → Section "Revenus par catégorie": tableau catégoriel           │
│    → Section "Dépenses par catégorie": tableau catégoriel          │
│    → Section "Total": income, expense, netResult                   │
│    → Section "Mouvements": listTransactions (expandable)           │
│    Mode read_only=true — formulaire généré automatiquement          │
│    → Permissions check: user a-finance:bilan:read?                  │
│                                                                     │
│  Step 7: Export PDF/CSV                                             │
│  ───────────────────────────────────────────────────────────────    │
│  PDF: Handlebars template + react-native-pdf-library               │
│    → Header avec logo org + titre bilan + période                  │
│    → Tableaux category breakdown avec couleurs vocab               │
│    → Graphique tendance mensuelle (bar chart)                      │
│    → Liste transactions détaillées (collapsible)                   │
│  CSV: sérialisation native JS avec délimiteur configuré             │
│    → Colonnes: date,type,category,scope,amount,description,ref     │
└─────────────────────────────────────────────────────────────────────┘
```

**Performance:**
- **Step 2** (hierarchie): index `(org_id, parent_unit_id)` → traversal O(N) avec N = nombre de groupes (rarement > 50)
- **Step 3** (scan transactions): index composite → O(log M) avec M = transactions. Objectif: < 3 secondes selon PRD §8.
- **Steps 4-5**: O(n) en mémoire, n = transactions filtrées (~100-1000/jour selon PRD §8)

---

## 6. Exemples Concrets — Église "MFE-JC Central"

### Structure Hiérarchique

```
MFE-JC Central (org_id: org-001, scope='org')
├── Chorale (unit_id: grp-chorale, scope='group:chorale')
│   ├── Soprano (unit_id: grp-soprano, scope='group:soprano')
│   └── Alto (unit_id: grp-alto, scope='group:alto')
├── Jeunesse (unit_id: grp-jeunesse, scope='group:jeunesse')
│   ├── Garçons (unit_id: grp-garcons, scope='group:garcons')
│   └── Filles (unit_id: grp-filles, scope='group:filles')
└── Département Formation (unit_id: grp-formation, scope='group:formation')
    ├── École du Dimanche (unit_id: grp-edd, scope='group:edd')
    └── Séminaires (unit_id: grp-seminaires, scope='group:seminaires')
```

### Transactions Simulées (mois de juillet 2026)

```
| id     | type    | amount | category  | scope_type | scope_target |
|--------|---------|--------|-----------|------------|--------------|
| tx-001 | income  | 5000   | tithes    | org        | NULL         |
| tx-002 | income  | 1500   | offerings| org        | NULL         |
| tx-003 | expense | 800    | maintenance| org       | NULL         |
| tx-004 | income  | 1200   | tithes    | group      | grp-chorale  |
| tx-005 | income  | 300    | offerings| group      | grp-chorale  |
| tx-006 | expense | 450    | events    | group      | grp-chorale  |
| tx-007 | income  | 900    | tithes    | group      | grp-soprano  |
| tx-008 | income  | 700    | tithes    | group      | grp-alto     |
| tx-009 | income  | 2000   | tithes    | group      | grp-jeunesse |
| tx-010 | expense | 600    | events    | group      | grp-jeunesse |
| tx-011 | income  | 1500   | tithes    | group      | grp-formation|
| tx-012 | expense | 350    | admin     | group      | grp-formation|
```

### Bilan 1: Org Seule (`scope='org'`)

```
=================================================================
           BILAN — MFE-JC Central (Caisse Principale)
           Période: Juillet 2026
=================================================================

REVENUS:
  Dîmes:              5 000.00
  Offrandes:          1 500.00
  ──────────────────────────────
  Total Revenus:      6 500.00

DÉPENSES:
  Maintenance:          800.00
  ──────────────────────────────
  Total Dépenses:       800.00

RÉSULTAT NET:         5 700.00
=================================================================
```

Seules tx-001, tx-002, tx-003 sont incluses. Les transactions de tous les groupes sont EXCLUES.

### Bilan 2: Consolidé Niveau 1 (`scope='all'`, org + départements principaux)

```
=================================================================
       BILAN CONSOLIDÉ — MFE-JC Central (Niveau 1)
       Inclut: Église + 3 départements
       Période: Juillet 2026
=================================================================

REVENUS:
  Caisse principale:  6 500.00
  Chorale:            1 500.00  (dîmes 1200 + offrandes 300)
  Jeunesse:           2 000.00  (dîmes 2000)
  Formation:          1 500.00  (dîmes 1500)
  ──────────────────────────────
  Total Revenus:     11 500.00

DÉPENSES:
  Caisse principale:    800.00  (maintenance)
  Chorale:              450.00  (événements)
  Jeunesse:             600.00  (événements)
  Formation:            350.00  (administration)
  ──────────────────────────────
  Total Dépenses:      2 200.00

RÉSULTAT NET:          9 300.00
=================================================================
```

tx-001 à tx-012 TOUTES incluses. Le filtre SQL: `scope_type='org' OR scope_target IN (grp-chorale, grp-jeunesse, grp-formation)`.

### Bilan 3: Consolidé Niveau 3 (`scope='all'`, org + TOUS les sous-groupes)

```
=================================================================
      BILAN CONSOLIDÉ — MFE-JC Central (Tous niveaux)
      Inclut: Église + 3 départements + 6 sous-groupes
      Période: Juillet 2026
=================================================================

REVENUS (Catégorie par Catégorie):
  Dîmes:              11 600.00
    ├─ Caisse principale:     5 000.00
    ├─ Chorale (soprano+alto): 1 900.00
    ├─ Jeunesse:              2 000.00
    └─ Formation:             1 500.00
  Offrandes:          2 500.00
    ├─ Caisse principale:     1 500.00
    └─ Chorale:                 300.00

DÉPENSES (Catégorie par Catégorie):
  Événements:         1 050.00
    ├─ Chorale:               450.00
    └─ Jeunesse:              600.00
  Administration:       350.00 (Formation)
  Maintenance:          800.00 (Caisse principale)

  Total Revenus:     14 100.00
  Total Dépenses:     2 200.00
  Résultat Net:     11 900.00
=================================================================
```

Le DFS traverse toute l'arbre: chorale→soprano+alto, jeunesse→garcons+filles, formation→edd+seminaires.

---

## 7. Workflow d'Approbation Déclaratif (étendu pour finance multi-niveau)

```yaml
# manifest.yaml — workflow d'approbation aware du scope de groupe
workflow_overrides:
  group_transaction_approval:
    id: "group_transaction_approval"
    trigger: "finance:transaction:created"
    condition: "transaction.scope_type == 'group'"
    steps:
      # Étape 1: le trésorier DU GROUPE approuve en premier
      - type: "approval"
        assign_to_role: "treasurer"
        # Resolution dynamique: quel trésorier? Celui du scope du groupe
        resolve_scope_from: "transaction.scope_target"
        timeout: "3d"

      # Étape 2: SI montant > seuil org → trésorier org + pasteur
      - type: "conditional"
        condition: "transaction.amount > settings.finance.approval_thresholds.treasurer_approval"

      - type: "approval"
        assign_to_role: "treasurer"
        only_if: "condition_met"
        scope: "org"
        timeout: "5d"

      - type: "auto"
        action: "set_status"
        value: "approved"

  org_transaction_approval:
    id: "org_transaction_approval"
    trigger: "finance:transaction:created"
    condition: "transaction.scope_type == 'org'"
    steps:
      - type: "approval"
        assign_to_role: "treasurer"
        scope: "org"
        timeout: "3d"
```

Le workflow engine résout `resolve_scope_from: "transaction.scope_target"` pour identifier le trésorier compétent **dynamiquement**, sans code dur.

---

## 8. Formulaire de Création de Transaction (déclaratif, aware du scope)

```yaml
# forms_overrides:
  finance_transaction_form:
    id: "finance_transaction_form"
    name: "Nouvelle Transaction"
    model: "Transaction"
    version: "1.0"
    fields:
      - name: "scope_type"
        label: "Portée"
        type: "select"
        required: true
        options:
          values:
            - key: "org"
              label: "Caisse principale de l'organisation"
            - key: "group"
              label: "Groupe spécifique"
        default: "org"

      - name: "scope_target"
        label: "Groupe"
        type: "select"
        required: false
        visible_if:
          field: "scope_type"
          operator: "eq"
          value: "group"
        options:
          # Résolu dynamiquement depuis org_units WHERE has_financial_scope = true
          source: "runtime:org_units.financial"
```

Lorsque l'utilisateur sélectionne un groupe, toutes les règles de validation et approbation se calibrent automatiquement.

---

## 9. Pourquoi le Hardcode a Échoué et Pourquoi le Déclaratif Fonctionne

### Ce qui a échoué (hardcoded)

| Problème | Cause | Conséquence |
|----------|-------|-------------|
| Hiérarchie rigide | `departments.children` est un tableau plat, pas un arbre récursif résolu | Impossible de gérer chorale → soprano/alto/ténor/basse |
| Bilan monolithique | Une seule fonction `calculateBilan()` avec `Q.where('org_id', orgId)` | Pas de distinction entre org-only, group-only, ou consouldé |
| Nouvelle = code | Ajouter un groupe = modifier `database-schema.ts` | Non-scaling, breaks invariant INV-002 |
| Transferts internes | Pas de mécanisme pour détecter org↔group transfers | Double comptage dans le bilan consolidé |
| Seuils rigides | `max_auto_approve: 500` dans un objet JS | Impossible d'avoir des seuils différents par groupe |

### Pourquoi le déclaratif/runtime fonctionne

| Requirement | Solution déclarative | Comment ça scalte |
|---|---|---|
| Hiérarchie imbriquée | `org_units.parent_unit_id` récursif + DFS runtime | Ajout d'un groupe = INSERT en base + manifest mis à jour |
| Bilan N niveaux | `resolveScope()` + `consolidation_rules` dans le manifest | Nouveau type de bilan = nouvelle entry YAML |
| Scope org vs group | 2 colonnes `scope_type` + `scope_target` sur transactions | Index composé → requête O(log n) |
| Transferts internes | `net_internal_transfers: true` dans la règle de consolidation | Détection automatique parent↔enfant |
| Seuils par groupe | `per_group_override` dans le manifest → deepMerge | Chaque org_unit a ses propres règles |
| Permissions | Déclarées dans le manifest, résolues par Capability Engine | Nouvelles permissions = YAML, pas TypeScript |

**Principe fondamental:** le manifest est la seule source de vérité. Le code des Platform Capabilities implémente UNIQUEMENT les moteurs (parser, validateur, résolveur, cache). Tout ce qui concerne LE MÉTIER (quelles catégories, quels seuils, quels scopes, quelles permissions) réside dans le YAML interprété au runtime.

---

## 10. Checklist d'Implémentation

- [ ] Ajouter `scope_type` et `scope_target` sur table `transactions` (migration PostgreSQL + WatermelonDB migration v3)
- [ ] Créer table `org_units` avec `has_financial_scope` et `parent_unit_id` récursif (ADR-014 extension)
- [ ] Implémenter `FinancialConsolidator.resolveScope()` avec support DFS/CTE récursive
- [ ] Étendre `calculateBalance()` avec filtre scope dynamique
- [ ] Ajouter `finance.consolidation_rules` au schema du Manifest Compiler
- [ ] Implémenter `per_group_override` avec deepMerge manifest parent→enfant
- [ ] Adapter le workflow engine pour `resolve_scope_from`
- [ ] Étendre le formulaire de transaction avec champ scope dynamique
- [ ] Tests: bilans org-only, group-only, all, partial avec 3+ niveaux de profondeur
- [ ] Coverage finance ≥ 90% (NeverBreak NB-09)
