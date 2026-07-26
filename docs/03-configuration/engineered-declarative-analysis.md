# Engineered Declarative: 10 Hardcoded Features Replaced by Runtime Configuration in Lumina

> **Date:** 2026-07-24
> **Status:** ANALYSIS COMPLETE
> **Sources:** `docs/03-configuration/manifest-compiler-engine.md`, `docs/01-platform-core/manifest-engine/index.md`, `docs/01-platform-core/forms-engine/index.md`, `docs/01-platform-core/workflow-engine/index.md`, `docs/01-platform-core/capability-engine/index.md`, `docs/01-platform-core/vocabulary-engine/index.md`, `src/shared/feature-hot-swap/engine.ts`, `schemas/manifest.draft-07.json`

---

## Introduction

Lumina remplace un systeme traditionnellement coded en dur par 5 moteurs declaratifs qui lisent des fichiers YAML/JSON a l'execution. Cette analyse montre comment 10 features typiques evoluent du hardcoded vers le declaratif.

**Les 5 capacités des Platform Capabilities:**

| Moteur | Rôle |
|--------|------|
| **Manifest Engine** | Lit et valide le manifest.yaml, gere l'identite org, les toggles features, roles, departements |
| **Vocabulary Engine** | Catalogue centralisé de tous les termes/metadonnées (enum, categories, labels, translations) |
| **Capability Engine** | Registre de toutes les fonctionnalités natives activables/désactivables via manifest |
| **Forms Engine** | Genere des ecrans React Native a partir de definitions JSON/YAML |
| **Workflow Engine** | Interprete des machines a etats declaratives (approbations, transitions, notifications) |

Le **Hot-Swap Engine** (`src/shared/feature-hot-swap/engine.ts`) gere l'activation/desactivation dynamique des modules de fonctionnalites sans redemarrage.

---

## 10 Features: Hardcoded vs Declarative Runtime

### Feature 1: Formulaires de Transaction Financiere

**Approche Classique (coded en dur)**

```tsx
// Before: code JSX dur dans features/finance/TransactionForm.tsx
export default function TransactionForm() {
  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('tithes');
  const [date, setDate] = useState(today());

  const categories = type === 'income'
    ? ['tithes', 'offerings', 'donations', 'fundraising']
    : ['utilities', 'salaries', 'maintenance', 'events'];

  return (
    <View>
      <Picker value={type} onValueChange={setType}>
        <Item label="Income" value="income" />
        <Item label="Expense" value="expense" />
        <Item label="Transfer" value="transfer" />
      </Picker>
      <TextInput keyboardType="numeric" value={amount} onChange={setAmount} />
      <Picker value={category} onValueChange={setCategory}>
        {categories.map(c => <Item key={c} label={c} value={c} />)}
      </Picker>
      {/* ... 8 autres champs codés manuellement */}
    </View>
  );
}
```

**Approche Runtime Declarative**

Le Forms Engine lit `forms_overrides` du manifest et genere le formulaire automatiquement. Aucun JSX de formulaire n'existe dans le code.

```yaml
# manifest.yaml — forms_overrides section
forms_overrides:
  finance_transaction_form:
    id: "finance_transaction_form"
    name: "Nouvelle Transaction"
    model: "Transaction"
    version: "1.0"
    fields:
      - name: "type"
        label: "Type"
        type: "select"
        required: true
        options:
          source: "vocab:finance/transaction_types"
        default: "income"
      - name: "amount"
        label: "Montant"
        type: "number"
        required: true
        min: 0
        step: 0.01
        currency: "settings.currency"
      - name: "category"
        label: "Catégorie"
        type: "select"
        required: true
        options:
          source: "vocab:finance/categories"
      - name: "receipt_attached"
        label: "Reçu joint"
        type: "file_upload"
        max_size_mb: 5
```

**Moteurs impliques:** Forms Engine (generation UI), Vocabulary Engine (options des select), Manifest Engine (lecture config)

**Avantage Runtime vs Hardcoded:**
- 0 ligne de JSX de formulaire a maintenir
- Nouveau formulaire = fichier YAML ajoute, pas de recompilation
- Validation client/serveur synchronisee automatiquement (meme definition)
- Champs conditionnels (`visible_if`) declares, pas implementes en logique React

**Exemple Organisation Specifique — Ecole:**

```yaml
# school-manifest.yaml — forms_overrides different de la classe
forms_overhoots:
  payment_form:
    id: "school_payment_form"
    name: "Pension Scolaire"
    model: "SchoolPayment"
    fields:
      - name: "student_id"
        label: "Eleve"
        type: "select"
        required: true
        options:
          source: "vocab:school/students"
      - name: "amount"
        label: "Montant Pension"
        type: "number"
        required: true
        min: 0
      - name: "term"
        label: "Trimestre"
        type: "select"
        required: true
        options:
          values: [{key:"T1",label:"1er Trimestre"},{key:"T2",label:"2e Trimestre"}]
```

Meme moteur Forms Engine, formulaire completement different, zéro code modifie.

---

### Feature 2: Workflow d'Approbation

**Approche Classique**

```tsx
// Before: if/switch hardcoded dans features/finance/approval.ts
function processTransaction(txn) {
  if (txn.type === 'expense') {
    if (txn.amount > 5000) {
      await notifyAdmin(txn); // require double approval
    } else {
      await notifyTreasurer(txn);
    }
  } else if (txn.type === 'income') {
    await autoPost(txn);
  }
  // ... 200 lignes de business logic IF/ELSE
}
```

**Approche Runtime Declarative**

```yaml
# manifest.yaml — workflow_overrides
workflow_overrides:
  transaction_approval:
    id: "transaction_approval"
    trigger: "finance:transaction:created"
    steps:
      - id: "validate"
        type: "auto"
        action: "validate_transaction"
      - id: "check_threshold"
        type: "conditional"
        condition: "amount > settings.max_auto_approve"
      - id: "treasurer_check"
        type: "approval"
        assign_to_role: "treasurer"
        timeout: "7d"
      - id: "pastor_check"
        type: "approval"
        only_if: "amount > settings.large_transaction_threshold"
        assign_to_role: "pastor"
        timeout: "14d"
      - id: "notify_all"
        type: "notification"
        send_to_roles: ["treasurer", "admin"]
        template: "transaction_approved"
      - id: "post_transaction"
        type: "auto"
        action: "set_status"
        value: "approved"
    on_timeout:
      treasurer_check: "escalate_to_admin"
      pastor_check: "send_reminder"
```

**Moteurs impliques:** Workflow Engine (interpretation), Capability Engine (verification que `finance:transaction:created` est une capability known), Manifest Engine (resolution settings references)

**Avantage Runtime vs Hardcoded:**
- Workflow modifiable sans recompilation (hot-reload via ManifestEngine.reloadManifest)
- Conditions lisibles: `amount > settings.max_auto_approve` refere aux settings, pas a des magic numbers
- Timeouts et escalades declares, pas implantes manuellement
- Audit trail automatique de chaque etape executee

**Exemple Organisation Specifique — ONG:**

```yaml
# ngo-manifest.yaml — workflow de depot different
workflow_overrides:
  expense_approval:
    id: "expense_approval"
    trigger: "finance:expense:submitted"
    steps:
      - type: "auto"
        action: "validate_receipt"
      - type: "approval"
        assign_to_role: "project_manager"
        timeout: "3d"
      - type: "approval"
        assign_to_role: "accountant"
        only_if: "amount > 2000"
        timeout: "5d"
      - type: "auto"
        action: "process_payment"
```

---

### Feature 3: Systeme de Roles et Permissions

**Approche Classique**

```tsx
// Before: roles defines dans un fichier TypeScript
export const ROLES = {
  ADMIN: { permissions: ['*'] },
  TREASURER: {
    permissions: ['finance:ledger:*', 'members:directory:read'],
  },
  STAFF: {
    permissions: ['members:directory:read', 'events:calendar:read'],
  },
};

// Before: permission check hardcode
function canUser(user, permission) {
  if (user.role === 'admin') return true;
  if (user.role === 'treasurer' && permission.startsWith('finance:')) return true;
  return false;
}
```

**Approche Runtime Declarative**

```yaml
# manifest.yaml
roles:
  - id: "super_admin"
    name: "Super Administrateur"
    permissions: ["*"]
    parent: null

  - id: "admin"
    name: "Administrateur Local"
    permissions:
      - "finance:*"
      - "members:*"
      - "events:*"
      - "reports:*"
      - "settings:*"
    parent: "super_admin"

  - id: "pastor"
    name: "Pasteur"
    permissions:
      - "members:directory:read"
      - "members:attendance:write"
      - "events:calendar:read"
      - "events:calendar:write"
      - "finance:bilan:read"
    parent: "admin"

  - id: "treasurer"
    name: "Trésorier"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:bilan:write"
      - "finance:rapport:read"
    parent: "admin"

  - id: "staff"
    name: "Staff"
    permissions:
      - "members:directory:read"
      - "events:calendar:read"
      - "finance:rapport:read"
    parent: "admin"
```

**Moteurs impliques:** Manifest Engine (lecture + validation schema AJV), Capability Engine (verification que chaque permission refere a une capability known via SafeCapabilityRegistry), Hot-Swap Engine (detection de changements de permissions entre manifests)

**Avantage Runtime vs Hardcoded:**
- Hierarchie des roles verifiee par algorithme de Kahn (O(V+E), cycle detection garanti)
- Permissions composables par heritage parent→enfant (R-03 manifest-engine: jamais de soustraction)
- Modification de role = mise a jour YAML, pas de deploiement code
- Profondeur max 5 niveaux impose par le moteur

**Exemple Organisation Specifique — Entreprise:**

```yaml
# company-manifest.yaml — roles differents meme structure
roles:
  - id: "ceo"
    name: "CEO"
    permissions: ["*"]
    parent: null
  - id: "manager"
    name: "Manager"
    permissions:
      - "hr:*"
      - "projects:*"
      - "finance:reports:read"
    parent: "ceo"
  - id: "employee"
    name: "Employee"
    permissions:
      - "members:directory:read"
      - "projects:own:read"
      - "finance:payroll:read"
    parent: "manager"
```

---

### Feature 4: Types d'Organisations (Feature Toggles)

**Approche Classique**

```tsx
// Before: switch sur le type d'org
const getAvailableFeatures = (orgType) => {
  switch(orgType) {
    case 'church': return ['finance','members','bible','sacraments','events'];
    case 'school': return ['finance','members','grades','attendance'];
    case 'ngo':    return ['finance','members','projects','reports'];
    case 'company':return ['finance','hr','members','projects'];
    default:       return ['finance','members'];
  }
};
```

**Approche Runtime Declarative**

```yaml
# manifest.yaml
features:
  finance:
    enabled: true
    sub_features: [ledger, bilan, rapport, budget]
  members:
    enabled: true
    sub_features: [directory, attendance]
  bible:
    enabled: false  # V2
  sacraments:
    enabled: false  # V2
  events:
    enabled: true
    sub_features: [calendar, registration]
  notifications:
    enabled: true
```

**Moteurs impliques:** Capability Engine (liste des capabilities registrees), Hot-Swap Engine (`activateAllFromManifest()` monte uniquement les features enabled), Manifest Engine (validation cross-reference avec capability registry)

**Avantage Runtime vs Hardcoded:**
- Pas de switch-case dans le code — le type d'org est une metadata du manifest, pas un flag de分支
- Activation/desactivation de feature hot-swap sans redemarrage (rollback automatique en cas de crash)
- Sub-features granulaires: activer `finance` mais desactiver `budget` separément
- Le Hot-Swap Engine detecte les changements entre deux manifests (`detectToggleChanges`) et applique uniquement les differences

**Exemple Organisation Specifique — Eglise vs ONG:**

```yaml
# Church: bible and sacraments enabled
church-features:
  bible: { enabled: true, sub_features: [readings, devotionals] }
  sacraments: { enabled: true, sub_features: [baptism, communion] }
  events: { enabled: true, sub_features: [worship_planning] }

# NGO: bible and sacraments absent, projects enabled
ngo-features:
  projects: { enabled: true, sub_features: [planning, reporting, budgets] }
  reports: { enabled: true, sub_features: [donor_reports, impact_metrics] }
```

---

### Feature 5: Templates de Rapports

**Approche Classique**

```tsx
// Before: every report format is a separate React component
import BilanReport from './reports/BilanReport';
import TresorerieReport from './reports/TresorerieReport';
import ImpactReport from './reports/IimpactReport';
// 50+ composants de rapports...
```

**Approche Runtime Declarative**

Rapports definis comme des formulaires-read-only speciaux avec des sections declarees:

```yaml
# manifest.yaml
forms_overrides:
  bilan_report_template:
    id: "bilan_report"
    name: "Bilan Financier"
    model: "FinancialReport"
    read_only: true
    sections:
      - id: "period"
        title: "Periode"
        fields: ["start_date", "end_date"]
      - id: "assets"
        title: "Actif"
        fields: ["cash", "bank_accounts", "receivables", "fixed_assets"]
      - id: "liabilities"
        title: "Passif"
        fields: ["payables", "loans", "provisions"]
      - id: "result"
        title: "Résultat"
        fields: ["net_income", "variance_analysis"]
```

**Moteurs impliques:** Forms Engine (rendu en mode read-only), Manifest Engine (gestion des templates de formulaires)

**Avantage Runtime vs Hardcoded:**
- Nouveau rapport = une definition YAML, pas un nouveau composant React
- Sections et champs configures par organisation sans toucher au code
- Mode read_only=true gere automatiquement par le Forms Engine

---

### Feature 6: Evenements Recurrents

**Approche Classique**

```tsx
// Before: cron jobs hardcodees
const recurringEvents = {
  church: [
    { day: 'sunday', time: '09:00', type: 'worship' },
    { day: 'thursday', time: '19:00', type: 'prayer' },
  ],
  school: [
    { day: 'monday', time: '08:00', type: 'assembly' },
  ],
};
```

**Approche Runtime Declarative**

```yaml
# manifest.yaml — events recurrents declares dans workflow_overrides
workflow_overrides:
  weekly_worship:
    id: "weekly_worship"
    trigger: "cron:every_sunday_09:00"
    steps:
      - type: "auto"
        action: "create_event"
        data:
          title: "Culte du Dimanche"
          category: "worship"
      - type: "notification"
        send_to_roles: ["admin", "pastor"]
        template: "event_created"

  monthly_budget_review:
    id: "monthly_budget_review"
    trigger: "cron:first_monday_monthly"
    steps:
      - type: "auto"
        action: "generate_report"
        report_type: "budget_comparison"
      - type: "approval"
        assign_to_role: "treasurer"
        timeout: "7d"
```

**Moteurs impliques:** Workflow Engine (trigger par cron), Forms Engine (si le rapport inclut un formulaire), Manifest Engine (resolver les templates de notification)

**Avantage Runtime vs Hardcoded:**
- Schedule modifiable via YAML (changer jour/heure sans redeployer)
- Actions variables: event creation, report generation, notification, approval
- Chaque org definit ses propres evenements recurrents

---

### Feature 7: Navigation / Routes Dinamiques

**Approche Classique**

```tsx
// Before: routes hardcodées dans app.config ou navigation config
const NAVIGATION_ROUTES = [
  '/dashboard',
  '/finance/ledger',
  '/finance/bilan',
  '/members/directory',
  '/members/attendance',
  '/events/calendar',
  '/settings',
];
```

**Approche Runtime Declarative**

Le Hot-Swap Engine gere l'enregistrement dynamique des routes via `DynamicRouteEntry`:

```typescript
// Chaque feature module expose ses routes lors du mount()
// Dans src/features/finance/module.ts:
mount(): UnmountHandle {
  const unregister = routeRegistry.register([
    { pathname: '/finance/ledger', ownerId: 'finance_ledger', moduleRef: FinanceLedgerScreen },
    { pathname: '/finance/bilan', ownerId: 'finance_ledger', moduleRef: FinanceBilanScreen },
  ]);
  return unregister;
}
```

Les routes sont declarees dans le manifest:

```yaml
# manifest.yaml — feature routes declarees implicitly via sub_features
features:
  finance:
    enabled: true
    sub_features: [ledger, bilan, rapport, budget]
  # Les routes /finance/* sont automatiquement montées car finance.enabled = true
```

**Moteurs impliques:** Hot-Swap Engine (register/unregister routes via RouteRegistry), Capability Engine (verifier qu'une feature active n'a pas de routes orphelines)

**Avantage Runtime vs Hardcoded:**
- Routes apparaissent/disparaissent dynamiquement quand on active/desactive une feature
- Cleanup automatique des subscriptions/routes au demount (pas de memory leak)
- Rollback automatique: si un module crash au mount, ses routes sont retirees

---

### Feature 8: Vocabulaire/Metadonnees (Enum, Categories)

**Approche Classique**

```tsx
// Before: arrays codées en dur
const INCOME_CATEGORIES = ['tithes', 'offerings', 'donations', 'fundraising'];
const EXPENSE_CATEGORIES = ['utilities', 'salaries', 'maintenance', 'events'];
const GENDERS = ['male', 'female', 'other'];
```

**Approche Runtime Declarative**

```yaml
# vocabulary/finance.yaml (charge par Vocabulary Engine)
namespace: "finance"
terms:
  income_categories:
    label: "Catégories de Revenus"
    parent: "transaction_types"
    filter: "type == income"
    values:
      - key: "tithes"
        label: "Dîmes"
        label_en: "Tithes"
        color: "#4CAF50"
      - key: "offerings"
        label: "Offrandes"
        label_en: "Offerings"
        color: "#FF9800"
      - key: "fundraising"
        label: "Collecte de fonds"
        label_en: "Fundraising"
        color: "#2196F3"

# vocabulary/common.yaml
namespace: "common"
terms:
  genders:
    label: "Genres"
    values:
      - key: "male"
        label: "Masculin"
        label_en: "Male"
      - key: "female"
        label: "Féminin"
        label_en: "Female"
```

Un formulaire referencia le vocabulaire plutot que de codifier les valeurs:

```yaml
fields:
  - name: "category"
    type: "select"
    options:
      source: "vocab:finance/income_categories"  # <-- reference externe
```

**Moteurs impliques:** Vocabulary Engine (lecture, traduction, recherche), Forms Engine (resolution des options via `source: "vocab:..."`)

**Avantage Runtime vs Hardcoded:**
- Traductions multilingues: `label` en FR, `label_en` en EN — Vocabulary Engine.translate() resout automatiquement selon la langue de l'org
- Couleurs associees aux valeurs pour rendu visuel uniforme
- Valeurs marquees `deprecated: true` au lieu d'etre supprimees (R-01 vocabulary-engine)
- Nouvelles categories ajoutees sans recompilation

---

### Feature 9: Structure de Departements/Groups

**Approche Classique**

```tsx
// Before: org chart hardcoded
const DEPARTMENTS = {
  church: [
    { id: 'direction', name: 'Direction', lead: 'pastor' },
    { id: 'finance_dept', name: 'Département Financier', lead: 'treasurer' },
    { id: 'chorale', name: 'Chorale', lead: 'staff' },
  ],
};
```

**Approche Runtime Declarative**

```yaml
# manifest.yaml
departments:
  - id: "direction"
    name: "Direction"
    role: "pastor"
    children: []

  - id: "finance_dept"
    name: "Département Financier"
    role: "treasurer"
    children: []

  - id: "chorale"
    name: "Chorale"
    role: "staff"
    children: ["chantres", "instrumentistes"]

  - id: "chantres"
    name: "Chantres"
    role: "staff"
    children: []

  - id: "instrumentistes"
    name: "Instrumentistes"
    role: "staff"
    children: []

  - id: "jeunesse"
    name: "Jeunesse"
    role: "staff"
    children: []
```

**Moteurs impliques:** Manifest Engine (buildDeptTree — resolution des refs departement→role), Capability Engine (verification que chaque departement.refere a un role existant)

**Avantage Runtime vs Hardcoded:**
- Structure hierarchique variable (enfants imbriques) resolue dynamiquement
- Chaque departement lie a un role automatiquement (pas de mapping manuel)
- Arbre complet valide par Kahn-like algorithm: pas de cycles, pas de ref brisée

---

### Feature 10: Regles de Validation Metier

**Approche Classique**

```tsx
// Before: validation spread across multiple files
function validateTransaction(data) {
  const errors = [];
  if (!data.type) errors.push('Type requis');
  if (!['income','expense','transfer'].includes(data.type)) errors.push('Type invalide');
  if (data.amount <= 0) errors.push('Montant doit être positif');
  if (data.amount > 999999999) errors.push('Montant excessif');
  if (!data.date) errors.push('Date requise');
  if (data.type === 'expense' && !data.category) errors.push('Catégorie requise pour dépense');
  // ... 30 validations differentes reparties dans 5 fichiers
}
```

**Approche Runtime Declarative**

```yaml
# validation-schema.yaml (referencé par le manifest)
fields:
  transaction:
    amount:
      type: "decimal"
      min: 0
      max: 999999999.99
      required: true
    date:
      type: "date"
      format: "YYYY-MM-DD"
      required: true
      default: "today"
    category:
      type: "enum"
      values_from: "vocab:finance/categories"
      required: true
      conditional_required:
        if_field: "type"
        if_value: "expense"
    description:
      type: "string"
      min_length: 1
      max_length: 500
```

**Moteurs impliques:** Manifest Engine (validation schema AJV pre-compilée), Forms Engine (reutilisation exacte des regles pour validation client-side + serveur-side), Vocabulary Engine (`values_from` resolu dynamiquement)

**Avantage Runtime vs Hardcoded:**
- Une seule source de verite pour validation (schema YAML utilise par Forms Engine cote client et backend cote serveur)
- Conditions conditional_required declarees, pas implementees
- Types de champs standardises (`decimal`, `date`, `enum`, `string`) maps automatiquement sur les composes RN appropries

---

## Templates d'Organisation par Defaut

Chaque template est un manifest.yaml pre-rempli avec les features, roles, et departements par defaut pour un type d'organisation.

### Template Eglise (church)

```yaml
# templates/church.yaml
version: "2.0"
organization:
  id: "TEMPLATE_CHURCH"
  type: "church"

features:
  finance: { enabled: true, sub_features: [ledger, bilan, rapport, budget] }
  members: { enabled: true, sub_features: [directory, attendance] }
  bible: { enabled: true, sub_features: [readings, devotionals] }
  sacraments: { enabled: true, sub_features: [baptism, communion, wedding] }
  events: { enabled: true, sub_features: [calendar, registration] }
  notifications: { enabled: true }
  reports: { enabled: true, sub_features: [pdf_export, csv_export] }

roles:
  - id: "admin"
    name: "Administrateur"
    permissions: ["*"]
    parent: null
  - id: "pastor"
    name: "Pasteur"
    permissions:
      - "members:directory:read"
      - "members:attendance:write"
      - "bible:*"
      - "sacraments:*"
      - "events:calendar:read"
      - "events:calendar:write"
      - "finance:bilan:read"
      - "finance:rapport:read"
    parent: "admin"
  - id: "treasurer"
    name: "Trésorier"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:bilan:write"
      - "finance:rapport:read"
      - "finance:rapport:write"
      - "finance:budget:read"
      - "finance:budget:write"
    parent: "admin"
  - id: "staff"
    name: "Staff Ministeriel"
    permissions:
      - "members:directory:read"
      - "events:calendar:read"
      - "finance:rapport:read"
    parent: "admin"

departments:
  - id: "direction"
    name: "Direction"
    role: "pastor"
    children: []
  - id: "finance_dept"
    name: "Département Financier"
    role: "treasurer"
    children: []
  - id: "worship"
    name: "Ministère de Louange"
    role: "staff"
    children: ["chorale", "equipe_technique"]
  - id: "youth"
    name: "Ministère Jeunesse"
    role: "staff"
    children: []
  - id: "children"
    name: "Ministère Enfants"
    role: "staff"
    children: []
```

### Template ONG (ngo)

```yaml
# templates/ngo.yaml
version: "2.0"
organization:
  id: "TEMPLATE_NGO"
  type: "ngo"

features:
  finance: { enabled: true, sub_features: [ledger, bilan, rapport, budget] }
  members: { enabled: true, sub_features: [directory, attendance] }
  projects: { enabled: true, sub_features: [planning, reporting, budgets] }
  reports: { enabled: true, sub_features: [donor_reports, impact_metrics] }
  notifications: { enabled: true }

roles:
  - id: "admin"
    name: "Directeur"
    permissions: ["*"]
    parent: null
  - id: "project_manager"
    name: "Chef de Projet"
    permissions:
      - "projects:*"
      - "members:directory:read"
      - "finance:rapport:read"
    parent: "admin"
  - id: "accountant"
    name: "Comptable"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:bilan:write"
      - "reports:*"
    parent: "admin"
  - id: "field_agent"
    name: "Agent de Terrain"
    permissions:
      - "members:directory:read"
      - "members:directory:write"
      - "projects:own:read"
      - "projects:own:write"
    parent: "project_manager"
```

### Template Ecole (school)

```yaml
# templates/school.yaml
version: "2.0"
organization:
  id: "TEMPLATE_SCHOOL"
  type: "school"

features:
  finance: { enabled: true, sub_features: [ledger, bilan, rapport] }
  members: { enabled: true, sub_features: [directory, attendance] }
  attendance: { enabled: true, sub_features: [daily_roll_call, monthly_summary] }
  grades: { enabled: true, sub_features: [report_cards, transcripts] }
  reports: { enabled: true, sub_features: [pdf_export, csv_export] }
  notifications: { enabled: true }

roles:
  - id: "admin"
    name: "Directeur"
    permissions: ["*"]
    parent: null
  - id: "principal"
    name: "Principal"
    permissions:
      - "members:directory:read"
      - "attendance:*"
      - "grades:*"
      - "finance:rapport:read"
      - "reports:*"
    parent: "admin"
  - id: "teacher"
    name: "Enseignant"
    permissions:
      - "members:directory:read"
      - "attendance:write"
      - "grades:write"
      - "grades:read"
    parent: "principal"
  - id: "accountant"
    name: "Comptable Scolaire"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
    parent: "admin"
  - id: "parent"
    name: "Parent/Tuteur"
    permissions:
      - "members:own:read"
      - "attendance:own:read"
      - "grades:own:read"
    parent: null
```

### Template Entreprise (company)

```yaml
# templates/company.yaml
version: "2.0"
organization:
  id: "TEMPLATE_COMPANY"
  type: "company"

features:
  finance: { enabled: true, sub_features: [ledger, bilan, rapport, budget] }
  members: { enabled: true, sub_features: [directory] }
  hr: { enabled: true, sub_features: [payroll, leave_management, onboarding] }
  projects: { enabled: true, sub_features: [planning, reporting] }
  reports: { enabled: true, sub_features: [pdf_export, csv_export] }
  notifications: { enabled: true }

roles:
  - id: "ceo"
    name: "PDG"
    permissions: ["*"]
    parent: null
  - id: "manager"
    name: "Manager"
    permissions:
      - "hr:*"
      - "projects:*"
      - "finance:reports:read"
    parent: "ceo"
  - id: "employee"
    name: "Employé"
    permissions:
      - "members:directory:read"
      - "projects:own:read"
      - "finance:payroll:read"
      - "hr:own:read"
    parent: "manager"
  - id: "hr_specialist"
    name: "Spécialiste RH"
    permissions:
      - "hr:payroll:write"
      - "hr:leave_management:write"
      - "hr:onboarding:write"
      - "members:directory:read"
    parent: "manager"
```

---

## Systeme de Groupes avec Features Personnalisées

Un admin de n'importe quelle organisation peut creer des groupes qui heritent des capacites de base de l'org mais ont des features et roles personnalises.

### Etape 1: Creer un Groupe

```yaml
# manifest-group.yaml — ajouté au manifest existant
groups:
  - id: "chorale"
    name: "Chorale"
    description: "Ministere de louange musicale"
    parent_department: "worship"
    features:
      events: { enabled: true, sub_features: [calendar, registration] }
      members: { enabled: true, sub_features: [directory] }
      notifications: { enabled: true }
    # finance explicitement NON inclus — la chorale n'a pas acces financier

  - id: "departement_marketing"
    name: "Departement Marketing"
    description: "Communication et marketing digital"
    parent_department: null  # root-level group
    features:
      members: { enabled: true, sub_features: [directory] }
      events: { enabled: true, sub_features: [calendar] }
      notifications: { enabled: true }
```

### Etape 2: Assigner des Formulaires Specifiques au Groupe

```yaml
# Le meme manifest — forms_overrides par groupe
forms_overrides:
  member_admission_chorale:
    id: "chorale_member_admission"
    name: "Adhesion a la Chorale"
    model: "ChoraleMember"
    group_scope: "chorale"  # <-- visible seulement dans le contexte du groupe
    fields:
      - name: "first_name"
        label: "Prenom"
        type: "text"
        required: true
      - name: "vocal_range"
        label: "Tessiture"
        type: "select"
        required: true
        options:
          values:
            - key: "soprano"
              label: "Soprano"
            - key: "alto"
              label: "Alto"
            - key: "tenor"
              label: "Ténor"
            - key: "bass"
              label: "Basse"
      - name: "instrument"
        label: "Instrument (optionnel)"
        type: "select"
        required: false
        options:
          values:
            - key: "piano"
              label: "Piano"
            - key: "guitar"
              label: "Guitare"
            - key: "drums"
              label: "Batterie"
            - key: "none"
              label: "Aucun (chant seul)"

  expense_request_marketing:
    id: "marketing_expense"
    name: "Demande de Depense Marketing"
    model: "MarketingExpense"
    group_scope: "departement_marketing"
    fields:
      - name: "campaign_name"
        label: "Nom de la Campagne"
        type: "text"
        required: true
      - name: "amount"
        label: "Montant"
        type: "number"
        required: true
        min: 0
      - name: "channels"
        label: "Canaux"
        type: "multiselect"
        required: true
        options:
          values:
            - key: "facebook"
              label: "Facebook Ads"
            - key: "instagram"
              label: "Instagram"
            - key: "email"
              label: "Email Marketing"
            - key: "print"
              label: "Print"
            - key: "radio"
              label: "Radio"
```

### Etape 3: Definir des Roles Personnalises pour le Groupe

```yaml
# Le meme manifest — roles limites au scope du groupe
roles:
  - id: "chef_chorale"
    name: "Chef de Chorale"
    description: "Responsable de la chorale — acces membres et evenements uniquement"
    permissions:
      - "members:directory:read"
      - "members:directory:write"
      - "events:calendar:read"
      - "events:calendar:write"
      - "notifications:send"
    parent: "admin"
    scope: "group:chorale"  # <-- limite a ce groupe uniquement

  - id: "chef_mentor_chorale"
    name: "Mentor Vocal"
    description: "Enseigne le chant — lecture seuls"
    permissions:
      - "members:directory:read"
      - "members:own:write"  # peut modifier son propre profil
    parent: "chef_chorale"
    scope: "group:chorale"

  - id: "marketing_lead"
    name: "Responsable Marketing"
    permissions:
      - "members:directory:read"
      - "events:calendar:write"
      - "notifications:send"
      - "finance:reports:read"
    parent: "admin"
    scope: "group:departement_marketing"
```

### Architecture de Resolution de Permissions

Le Capability Engine resout les permissions en 3 étapes:

```
1. Chercher permission au niveau du USER → utilisateur a-t-il ce role?
2. Si role a scope="group:X", verifier que l'utilisateur appartient au groupe X
3. Permission accordée uniquement si (role_permissions ∩ resource_requested) ≠ ∅
```

Ca veut dire qu'un `chef_chorale` peut modifier les membres ET les evenements de la chorale, mais ne PEUT PAS lire la finance — meme si le role parent `admin` a `finance:*`. L'heritage descend uniquement, jamais l'inverse (regle R-03).

---

## Systeme de Templates d'Organisation

### Qu'est-ce qu'un Template Exactement?

Un template est un **manifest.yaml pre-rempli avec configuration par defaut** pour un type d'organisation. Concretement:

```
templates/
  church.yaml        # Eglise standard
  church-small.yaml  # Petite eglise (moins de departements)
  church-mission.yaml  # Mission (encore plus minimal)
  ngo.yaml           # ONG
  school.yaml        # Ecole
  company.yaml       # Entreprise
  custom.yaml        # Vide — point de depart custom
```

Chaque fichier contient:
- `features:` activées par défaut (avec sub_features)
- `roles:` pre-definis pour ce type d'org
- `departments:` structure hierarchique courante
- `workflow_overrides:` workflows standards (ex: approbation finance pour eglise)
- `forms_overrides:` formulaires courants (ex: admission membre)
- `validation_schema:` regles de validation spécifiques

**Template != Code:** Un template est 100% declareatif. Pas de TypeScript, pas de JSX — juste du YAML interpretation par les moteurs.

### Creation d'un Template Personnalise

Un admin peut cloner un template existant et modifier:

```yaml
# templates/mon-eglise-speciale.yaml — clone de church.yaml
version: "2.0"
organization:
  id: "TEMPLATE_CUSTOM_CHURCH"
  type: "custom"  # ← type custom = user-defined
  inherits_from: "church"  # ← hérite des features/roles par défaut

features:
  # Herite de church.yaml: finance, members, bible, sacraments, events
  # Ajouts specifiques:
  bible_study: { enabled: true, sub_features: [tracking, discussions] }

  # Desactivation selective:
  sacraments: { enabled: false }  # église pas besoin de sacraments

roles:
  # Herite de church.yaml: admin, pastor, treasurer, staff
  # Ajouts:
  - id: "bible_teacher"
    name: "Enseignant Bible"
    permissions:
      - "bible_study:*"
      - "members:directory:read"
    parent: "pastor"
  - id: "ushers"
    name: "Buissoneers"
    permissions:
      - "members:directory:read"
      - "events:calendar:read"
    parent: "staff"
```

### Helitage de Templates

```
church (base)
  └── church-small (↓ departments, ↓ roles)
        └── church-mission (↓ features, mission-mode)
  └── church-large (↑ départements, ↑ roles)
```

L'heritage se fait par resolution en cascade au niveau du Manifest Compiler:

```yaml
# Church-mission herite de church-small, qui herite de church
version: "2.0"
organization:
  id: "org-mission-001"
  type: "custom"
  inherits_from: "church-small"

features:
  # church-small herite church features
  # On DESACTIVE bible et sacraments pour la mission
  bible: { enabled: false }
  sacraments: { enabled: false }
  # On GARDE tout le reste (finance, members, events, notifications)

roles:
  # church-small herite church roles
  # On SUPPRIME pastor et treasurer, on REMPLACE par:
  - id: "mission_leader"
    name: "Leader de Mission"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "members:directory:read"
      - "members:directory:write"
      - "events:calendar:write"
    parent: null  # racine du graphe

  # On garde admin (super-admin platform)
  # pastor et treasurer sont herites MAIS non utilises

departments:
  # church-small a: direction, finance_dept, worship
  # On simplifie pour la mission:
  - id: "mission_team"
    name: "Equipe de Mission"
    role: "mission_leader"
    children: []
```

Mechanism de resolution de l'heritage (dans `ManifestCompiler.resolveCrossReferences`):

```
1. Charger le template base (church.yaml) → parsedBase
2. Charger le child template (church-small.yaml) → parsedChild
3. deepMerge(parsedBase, parsedChild) → child override base
4. Si child declares features: surcharge les features du parent
5. Si child declares roles: fusionne (child ajoute roles +, child peut override existing par id)
6. Si child supprime un role: le role est retire (explicit remove)
7. Application recursive jusqu'a la racine
8. Validation AJV + Zod sur le resultat merge
9. Cache par orgId (LRUCache.invalidateOrg)
```

### Différence entre Template et Manifest Runtime

| Aspect | Template | Manifest Runtime |
|--------|----------|------------------|
| **Où stocke** | `templates/` (git, versionne avec le code) | Base de donnee (INSFORGE server) ou filesystem local |
| **Modifiable?** | Non (template = immuable, source de reference) | Oui (admin peut modifier via UI Manifest Editor) |
| **Quand use** | Au creation d'une nouvelle organization | A chaque lancement d'app + lorsque l'admin change la config |
| **Versioning** | Versionne avec le code source (tags git) | Versionne independemment (schema version + audit log) |
| **Scope** | Global (applique a TOUTES les org de ce type) | Local (une org precise) |
| **Validation** | Valide au build (template invalide = compile error) | Valide au deploy (template invalide = deploy bloque, org degrade gracefully) |
| **Inheritance** | Peut heriter d'un autre template (`inherits_from`) | Peut heriter d'un template (`organization.inherits_from`) |

Concretement: quand une nouvelle eglise s'inscrit, le systeme:

```
1. Choisir template "church" basé sur le type sélectionné
2. Copier le template dans une nouvelle instance runtime manifest
3. L'admin personnalise: change les features, ajoute des roles, modifie les workflows
4. Le manifest runtime evolue independemment du template original
5. Si le template "church" evolue dans une nouvelle version de Lumina, l'admin peut choisir de "pull" les nouvelles features par defaut
```

---

## Resume de la Transformation

| Feature | Avant (Hardcoded) | Apres (Declaratif) | Moteurs |
|---------|-------------------|---------------------|---------|
| Formulaires | JSX/TSX ~500 lignes | YAML form definition | Forms Engine + Vocabulary Engine |
| Workflows | if/switch ~200 lignes | YAML workflow steps | Workflow Engine + Manifest Engine |
| Roles/Permissions | TS constants ~100 lignes | YAML roles array + parent refs | Manifest Engine + Capability Engine |
| Feature Toggles | switch(type) | YAML features.enabled | Hot-Swap Engine + Capability Engine |
| Rapports | Composants React separates | YAML form templates read_only | Forms Engine |
| Events Recurrents | Cron jobs TS | YAML workflow triggers | Workflow Engine |
| Navigation | Routes constantes | Dynamic routes via mount() | Hot-Swap Engine (RouteRegistry) |
| Enum/Vocab | Arrays TS en dur | YAML vocabulary namespaces | Vocabulary Engine + Forms Engine |
| Departements | Objets TS hardcodes | YAML departments tree | Manifest Engine (dept tree resolver) |
| Validation | Fonctions TS eparses | YAML field definitions | Manifest Engine (AJV) + Forms Engine |

**Resultat net:** Les 5 capacités des Platform Capabilities interpretent la configuration au lieu d'executer du code pre-ecrit. Une nouvelle organisation = un manifest YAML. Un nouveau type d'organisation = un nouveau template YAML. Un admin changeant de processus = modification YAML sans recompilation.
