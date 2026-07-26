# Moteur de Manifest — Spécification Complète

**Doc ID:** DOC-PLATFORM-MANIFEST  
**Version:** 2.0  
**Statut:** VALIDÉ  
**Dépendances:** VOCABULARY-ENGINE (DOC-PLATFORM-VOCA), CAPABILITY-ENGINE (DOC-PLATFORM-CAPA)

---

## 1. Vision

Le **Manifest Engine** est le cœur de l'agnosticisme de Lumina. Il interprète des fichiers de configuration (JSON/YAML) qui décrivent **ce qu'est une organisation** — pas comment elle fonctionne. Le code des Platform Capabilities reste toujours aveugle au type d'organisation.

**Principe fondamental :** Si une règle métier ne peut pas être exprimée en configuration manifest, elle doit être ajoutée comme capability native des Platform Capabilities, jamais codée en dur dans une org-specific layer.

---

## 2. Responsabilités

| Responsabilité | Description |
|---|---|
| **Organisation Identity** | Nom, type, logo, langue, fuseau horaire |
| **Structure Hiérarchique** | Rôles, départements, relations parent-enfant |
| **Feature Toggles** | Quelles fonctionnalités sont activées pour cette org |
| **Validation Schema** | Règles de validation spécifiques au type d'org |
| **Routing Configuration** | Comment les données sont organisées et accessibles |

---

## 3. Format de Manifest

### 3.1 Structure de Base

```yaml
# manifest.yaml
version: "2.0"
organization:
  id: "org-uuid"
  name: "Nom de l'organisation"
  type: "church" # church | school | ngo | company | custom
  language: "fr-FR"
  timezone: "Africa/Lubumbashi"
  created_at: "2026-01-01T00:00:00Z"

settings:
  currency: "USD"
  fiscal_year_start: "01-01"
  require_approval: true
  max_transaction_amount: 100000

features:
  finance:
    enabled: true
    sub_features:
      - ledger
      - bilan
      -Rapport
      - budget
  members:
    enabled: true
    sub_features:
      - directory
      - attendance
  bible:
    enabled: false
  events:
    enabled: true
    sub_features:
      - calendar
      - registration

roles:
  - id: "admin"
    name: "Administrateur"
    permissions: ["*"]
    parent: null
    
  - id: "treasurer"
    name: "Trésorier"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:rapport:read"
    parent: "admin"
    
  - id: "pastor"
    name: "Pasteur"
    permissions:
      - "members:directory:read"
      - "members:attendance:write"
      - "events:calendar:read"
    parent: "admin"

departments:
  - id: "finance"
    name: "Département Financier"
    role: "treasurer"
    children: []
    
  - id: "ministry"
    name: "Département Ministeriel"
    role: "pastor"
    children: []
```

### 3.2 Validation Schema

```yaml
# validation-schema.yaml
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
    description:
      type: "string"
      min_length: 1
      max_length: 500
      
member:
  first_name:
    type: "string"
    min_length: 1
    max_length: 100
    required: true
  last_name:
    type: "string"
    min_length: 1
    max_length: 100
    required: true
  email:
    type: "email"
    required: false
  phone:
    type: "phone"
    required: false
```

---

## 4. Cycle de Vie du Manifest

```
┌─────────────┐
│  Édition    │  ← UI Manifest Editor (Admin only)
│  (JSON/YAML)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Validation │  ← Schema validation (JSON Schema)
│              │     Cross-reference with Vocab Engine
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Compilation│  ← Convert to runtime config object
│              │     Cache in memory + SQLite
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Runtime    │  ← Engines read compiled config
│  Consumption│     (Manifest Engine is READ-ONLY at runtime)
└─────────────┘
```

---

## 5. API du Moteur

### 5.1 Méthodes Publiques

```typescript
interface ManifestEngine {
  // Chargement
  loadManifest(orgId: string): Promise<CompiledManifest>;
  reloadManifest(orgId: string): Promise<void>;
  
  // Accès en lecture
  getSettings(orgId: string): OrgSettings;
  getFeatures(orgId: string): FeatureToggle;
  getRoles(orgId: string): RoleDefinition[];
  getPermissions(roleId: string): Permission[];
  isFeatureEnabled(orgId: string, feature: string): boolean;
  hasPermission(userId: string, permission: string): boolean;
  
  // Modification (admin only)
  updateManifest(orgId: string, manifest: ManifestInput): Promise<void>;
  validateManifest(manifest: ManifestInput): ValidationResult;
}
```

### 5.2 Events

```typescript
interface ManifestEvents {
  "manifest:loaded": (orgId: string) => void;
  "manifest:updated": (orgId: string, version: string) => void;
  "manifest:invalid": (orgId: string, errors: ValidationError[]) => void;
  "feature:toggled": (orgId: string, feature: string, enabled: boolean) => void;
}
```

---

## 6. Règles d'Or

| Règle | Description |
|---|---|
| **R-01** | Un manifest ne peut JAMAIS ajouter de nouvelles capabilities. Il ne peut qu'activer/désactiver celles existantes. |
| **R-02** | La hiérarchie des rôles ne peut pas dépasser 5 niveaux de profondeur. |
| **R-03** | Les permissions se composent (héritage parent → enfant) mais ne peuvent jamais être "soustraites". |
| **R-04** | Un manifest invalide bloque TOUTE l'application pour cette organisation. |
| **R-05** | Le manifest est versionné. Chaque modification crée une nouvelle version. |

---

## 7. Exemples d'Utilisation

### 7.1 Église

```yaml
type: "church"
features:
  finance: { enabled: true }
  members: { enabled: true }
  bible: { enabled: true }
  sacraments: { enabled: true }
  events: { enabled: true }
roles:
  - id: "pastor"
    permissions: ["bible:*", "sacraments:*", "members:directory:read"]
  - id: "treasurer"
    permissions: ["finance:*", "reports:*"]
```

### 7.2 ONG

```yaml
type: "ngo"
features:
  finance: { enabled: true }
  members: { enabled: true }
  projects: { enabled: true }
  reports: { enabled: true }
roles:
  - id: "director"
    permissions: ["*"]
  - id: "project_manager"
    permissions: ["projects:*", "members:directory:read"]
  - id: "accountant"
    permissions: ["finance:*", "reports:*"]
```

### 7.3 Entreprise

```yaml
type: "company"
features:
  finance: { enabled: true }
  members: { enabled: true }
  hr: { enabled: true }
  projects: { enabled: true }
roles:
  - id: "ceo"
    permissions: ["*"]
  - id: "manager"
    permissions: ["hr:*", "projects:*", "finance:reports:read"]
  - id: "employee"
    permissions: ["members:directory:read", "projects:own:read"]
```

---

## 8. Dépendances

- **Vocabulary Engine** (DOC-PLATFORM-VOCA) : Les valeurs enum des champs utilisent le vocabulaire défini.
- **Capability Engine** (DOC-PLATFORM-CAPA) : Les features activées dans le manifest correspondent aux capabilities enregistrées.
- **Forms Engine** (DOC-PLATFORM-FORMS) : Le manifest définit quels formulaires sont disponibles.

---

## 9. Critères d'Achèvement

- [x] Format YAML/JSON défini et validé
- [x] API TypeScript complète implémentée
- [x] Système de versioning des manifests
- [x] Validation croisée avec Vocab Engine
- [x] Exemples pour 3 types d'organisation (église, ONG, entreprise)
- [x] Règles d'or documentées et testées
